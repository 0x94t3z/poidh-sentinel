import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { runAgent } from "@/features/bot/agent";
import { publishReply } from "@/features/bot/cast-reply";
import { appendLog } from "@/features/bot/bot-log";
import {
  getConversation,
  setConversation,
  clearConversation,
  parseChain,
  parseAmount,
  isConfirmation,
  isRejection,
  makeUniqueAmount,
  CHAIN_CONFIG,
} from "@/features/bot/conversation-state";
import { registerPendingPayment, getAllAwaitingPayment } from "@/features/bot/conversation-state-registry";
import { markCastProcessed, pruneProcessedCasts, getBountyThread } from "@/db/actions/bot-actions";
import type { WebhookPayload, BotLogEntry } from "@/features/bot/types";

const BOT_FID = 3273077;

function getBotWalletAddress(): string {
  return process.env.BOT_WALLET_ADDRESS ?? process.env.NEYNAR_WALLET_ADDRESS ?? "";
}

function verifySignature(body: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac("sha512", secret);
    hmac.update(body);
    const digest = hmac.digest("hex");
    const sigBuf = Buffer.from(signature, "hex");
    const digestBuf = Buffer.from(digest, "hex");
    if (sigBuf.length !== digestBuf.length) return false;
    return timingSafeEqual(sigBuf, digestBuf);
  } catch {
    return false;
  }
}

function isBotMentioned(payload: WebhookPayload): boolean {
  const { mentioned_profiles } = payload.data;
  if (mentioned_profiles?.some((p) => p.fid === BOT_FID)) return true;
  return payload.data.text.toLowerCase().includes("@poidh-sentinel");
}

function isFromBot(payload: WebhookPayload): boolean {
  return payload.data.author.fid === BOT_FID;
}

// Check if the parent cast was authored by the bot (reply to bot's cast)
async function isReplyToBot(parentHash: string | null): Promise<boolean> {
  if (!parentHash) return false;
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      { headers: { "x-api-key": apiKey } },
    );
    if (!res.ok) return false;
    const data = (await res.json()) as { cast?: { author?: { fid?: number } } };
    return data.cast?.author?.fid === BOT_FID;
  } catch {
    return false;
  }
}

async function reply(text: string, parentHash: string): Promise<void> {
  const signerUuid = process.env.BOT_SIGNER_UUID ?? "";
  if (!signerUuid) return;
  const trimmed = text.slice(0, 400);
  await publishReply({ text: trimmed, parentHash, signerUuid });
}

// Check if a message looks like the user is trying to answer the chain question
// (contains a chain name, an amount, or a clear "go ahead" signal)
function looksLikeChainAnswer(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("arbitrum") ||
    lower.includes("arb") ||
    lower.includes("base") ||
    lower.includes("degen") ||
    /\d+(\.\d+)?/.test(lower) // contains a number (could be an amount)
  );
}

// Handle the multi-step bounty creation conversation
async function handleConversationFlow(
  threadHash: string,
  castHash: string,
  text: string,
  authorFid: number,
  authorUsername: string,
): Promise<string | null> {
  const state = await getConversation(threadHash);
  if (!state) return null;

  // Only respond to the same user who started the conversation
  if (state.authorFid !== authorFid) return null;

  const lower = text.toLowerCase();

  // --- Step: awaiting_confirmation ---
  if (state.step === "awaiting_confirmation") {
    if (isRejection(lower)) {
      await clearConversation(threadHash);
      return "no worries — mention me anytime if you want a different idea.";
    }

    if (isConfirmation(lower)) {
      await setConversation(threadHash, { ...state, step: "awaiting_chain" });
      return `nice! which chain — arbitrum, base, or degen? and how much do you want to put up? minimums: arbitrum/base = 0.001 ETH, degen = 1000 DEGEN.`;
    }

    // Not a clear yes or no — stay silent, don't disrupt the user's conversation
    return null;
  }

  // --- Step: awaiting_chain ---
  if (state.step === "awaiting_chain") {
    const chain = parseChain(lower);
    const amount = parseAmount(lower);

    if (!chain) {
      // Only re-prompt if the message looks like they're attempting an answer
      // (has a number or chain-adjacent word). Ignore casual conversation.
      if (!looksLikeChainAnswer(lower)) return null;
      return `which chain? arbitrum, base, or degen — just let me know and include how much you want to put up.`;
    }

    const config = CHAIN_CONFIG[chain];

    if (amount) {
      const numAmount = parseFloat(amount);
      const minAmount = parseFloat(config.minAmount);
      if (numAmount < minAmount) {
        return `minimum for ${config.label} is ${config.minAmount} ${config.currency}. want to go with that amount?`;
      }
    }

    const finalAmount = amount ?? config.minAmount;
    const walletAddress = getBotWalletAddress();

    const existingPending = (await getAllAwaitingPayment()).filter(p => (p.state.chain ?? "arbitrum") === chain);
    const uniqueAmount = makeUniqueAmount(finalAmount, existingPending.length);

    const updatedState = { ...state, step: "awaiting_payment" as const, chain, amountEth: finalAmount, uniqueAmount };
    await setConversation(threadHash, updatedState);

    if (!walletAddress) {
      return `got it — ${config.label}, ${finalAmount} ${config.currency}. wallet not configured yet, check back soon.`;
    }

    await registerPendingPayment(threadHash, castHash, updatedState);

    const sendAmount = uniqueAmount !== finalAmount ? uniqueAmount : finalAmount;
    return `send exactly ${sendAmount} ${config.currency} to ${walletAddress} on ${config.label}. also include ~${config.minGas} for gas. once i see the funds i'll create the bounty automatically.`;
  }

  // --- Step: awaiting_payment ---
  if (state.step === "awaiting_payment") {
    if (
      lower.includes("sent") ||
      lower.includes("done") ||
      lower.includes("transferred") ||
      lower.includes("paid") ||
      lower.includes("funded")
    ) {
      return `got it — checking for the deposit now. once confirmed on-chain i'll create the bounty and post the link here. usually takes a minute or two.`;
    }
    return null;
  }

  return null;
}

// Check active thread — async now since getConversation hits DB
async function isInActiveThread(threadHash: string): Promise<boolean> {
  const state = await getConversation(threadHash);
  return !!state;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
  }

  const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get("x-neynar-signature") ?? "";
    if (!signature || !verifySignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type !== "cast.created") return NextResponse.json({ ok: true, skipped: "not cast" });
  if (isFromBot(payload)) return NextResponse.json({ ok: true, skipped: "own cast" });

  const { hash, thread_hash, parent_hash, author, text } = payload.data;

  // Atomic DB dedup — works across all serverless instances
  const isNew = await markCastProcessed(hash);
  if (!isNew) return NextResponse.json({ ok: true, skipped: "duplicate" });

  // Prune old entries occasionally (1% of requests) to keep table lean
  if (Math.random() < 0.01) void pruneProcessedCasts();

  const mentioned = isBotMentioned(payload);

  // Check active thread by thread_hash OR parent_hash — parallel DB lookups
  const [threadActive, parentActive, bountyThread, replyToBot] = await Promise.all([
    isInActiveThread(thread_hash),
    parent_hash ? isInActiveThread(parent_hash) : Promise.resolve(false),
    getBountyThread(thread_hash),
    isReplyToBot(parent_hash),
  ]);

  const activeThreadKey = threadActive
    ? thread_hash
    : (parentActive && parent_hash ? parent_hash : null);
  const inActiveThread = !!activeThreadKey;
  const inBountyThread = !!bountyThread;

  console.log(
    `[webhook] hash=${hash.slice(0, 10)} thread=${thread_hash.slice(0, 10)} ` +
    `parent=${parent_hash?.slice(0, 10) ?? "none"} mentioned=${mentioned} ` +
    `inActiveThread=${inActiveThread} inBountyThread=${inBountyThread} replyToBot=${replyToBot} ` +
    `author=${author.username}(${author.fid})`
  );

  if (!mentioned && !inActiveThread && !inBountyThread && !replyToBot) {
    return NextResponse.json({ ok: true, skipped: "not mentioned" });
  }

  const logEntry: BotLogEntry = {
    id: hash,
    timestamp: new Date().toISOString(),
    triggerCastHash: hash,
    triggerAuthor: author.username,
    triggerText: text,
    action: "general_reply",
    replyText: "",
    status: "success",
  };

  try {
    // --- Priority 1: active conversation flow (multi-step) ---
    if (inActiveThread && activeThreadKey) {
      const flowReply = await handleConversationFlow(
        activeThreadKey, hash, text, author.fid, author.username,
      );

      if (flowReply !== null) {
        logEntry.action = "conversation_flow";
        logEntry.replyText = flowReply;
        await reply(flowReply, hash);
        await appendLog(logEntry);
        return NextResponse.json({ ok: true });
      }
      // Never fall through to the agent when a conversation is in progress
      console.log(`[webhook] silent — in active thread but no flow match (step=${(await getConversation(activeThreadKey))?.step})`);
      return NextResponse.json({ ok: true, skipped: "unrelated thread reply" });
    }

    // --- Priority 2: direct reply to one of the bot's casts OR bounty thread ---
    if (replyToBot || (inBountyThread && bountyThread)) {
      const agentResult = await runAgent({
        castHash: hash,
        threadHash: thread_hash,
        authorUsername: author.username,
        authorFid: author.fid,
        castText: text,
        action: "general_reply",
        replyToBot,
        bountyContext: bountyThread ? {
          name: bountyThread.bountyName,
          description: bountyThread.bountyDescription,
          chain: bountyThread.chain,
          poidhUrl: bountyThread.poidhUrl,
          winnerClaimId: bountyThread.winnerClaimId,
          winnerIssuer: bountyThread.winnerIssuer,
          winnerReasoning: bountyThread.winnerReasoning,
        } : undefined,
      });
      logEntry.action = agentResult.action;
      logEntry.replyText = agentResult.reply;
      await reply(agentResult.reply, hash);
      await appendLog(logEntry);
      return NextResponse.json({ ok: true });
    }

    // --- Priority 3: fresh mention — run AI agent ---
    const agentResult = await runAgent({
      castHash: hash,
      threadHash: thread_hash,
      authorUsername: author.username,
      authorFid: author.fid,
      castText: text,
      action: "general_reply",
    });

    logEntry.action = agentResult.action;
    logEntry.replyText = agentResult.reply;

    // CRITICAL: Save conversation state BEFORE publishing the reply.
    // If state is saved after the reply, the user (or a fast re-delivery from Neynar)
    // can send a follow-up cast before the DB write completes — isInActiveThread() returns
    // false, the webhook falls through to runAgent(), and a second reply is sent.
    if (agentResult.action === "suggest_bounty" && agentResult.suggestedIdea) {
      const newState = {
        step: "awaiting_confirmation" as const,
        authorFid: author.fid,
        authorUsername: author.username,
        suggestedIdea: agentResult.suggestedIdea,
        lastUpdated: new Date().toISOString(),
      };
      await setConversation(thread_hash, newState);
      if (hash !== thread_hash) await setConversation(hash, newState);
    }

    if (agentResult.action === "create_bounty_onchain" && agentResult.onChainBounty) {
      const newState = {
        step: "awaiting_chain" as const,
        authorFid: author.fid,
        authorUsername: author.username,
        suggestedIdea: {
          name: agentResult.onChainBounty.name,
          description: agentResult.onChainBounty.description,
        },
        lastUpdated: new Date().toISOString(),
      };
      await setConversation(thread_hash, newState);
      if (hash !== thread_hash) await setConversation(hash, newState);
    }

    await reply(agentResult.reply, hash);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] error:", message);
    logEntry.status = "error";
    logEntry.errorMessage = message;
  }

  await appendLog(logEntry);
  return NextResponse.json({ ok: true });
}
