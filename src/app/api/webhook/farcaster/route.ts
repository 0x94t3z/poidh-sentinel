import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { parseEther } from "viem";
import { runAgent } from "@/features/bot/agent";
import { publishReply } from "@/features/bot/cast-reply";
import { appendLog } from "@/features/bot/bot-log";
import {
  getConversation,
  setConversation,
  clearConversation,
  parseChain,
  parseAmount,
  parseBountyType,
  isConfirmation,
  isRejection,
  makeUniqueAmount,
  addPlatformFee,
  PLATFORM_FEE_PCT,
  CHAIN_CONFIG,
} from "@/features/bot/conversation-state";
import { registerPendingPayment, getAllAwaitingPayment } from "@/features/bot/conversation-state-registry";
import { markCastProcessed, pruneProcessedCasts, getBountyThread, updateBounty, getActiveBounty } from "@/db/actions/bot-actions";
import { cancelBounty } from "@/features/bot/poidh-contract";
import { resolveAddressesToUsernames, MIN_OPEN_DURATION_HOURS } from "@/features/bot/bounty-loop";
import type { WebhookPayload, BotLogEntry } from "@/features/bot/types";

const BOT_FID = parseInt(process.env.BOT_FID ?? "0", 10);

function getBotWalletAddress(): string {
  // Derive address directly from BOT_WALLET_PRIVATE_KEY — no need for BOT_WALLET_ADDRESS env var
  try {
    const { privateKeyToAccount } = require("viem/accounts") as typeof import("viem/accounts");
    const key = process.env.BOT_WALLET_PRIVATE_KEY ?? "";
    if (!key) return "";
    const normalized = key.startsWith("0x") ? key : `0x${key}`;
    return privateKeyToAccount(normalized as `0x${string}`).address;
  } catch {
    return "";
  }
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
  const botUsername = process.env.BOT_USERNAME ?? "poidh-sentinel";
  return payload.data.text.toLowerCase().includes(`@${botUsername}`);
}

function isFromBot(payload: WebhookPayload): boolean {
  return payload.data.author.fid === BOT_FID;
}

// Check if the parent cast was authored by the bot (reply to bot's cast)
// Also returns the parent cast's embeds so we can extract image URLs without a second API call
async function fetchParentCastInfo(parentHash: string | null): Promise<{
  isFromBot: boolean;
  imageUrls: string[];
}> {
  if (!parentHash) return { isFromBot: false, imageUrls: [] };
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return { isFromBot: false, imageUrls: [] };
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      { headers: { "x-api-key": apiKey } },
    );
    if (!res.ok) return { isFromBot: false, imageUrls: [] };
    const data = (await res.json()) as {
      cast?: {
        author?: { fid?: number };
        embeds?: Array<{ url?: string }>;
      };
    };
    const cast = data.cast;
    const isFromBot = cast?.author?.fid === BOT_FID;
    const imageUrls = extractImageUrls(cast?.embeds ?? []);
    return { isFromBot, imageUrls };
  } catch {
    return { isFromBot: false, imageUrls: [] };
  }
}

// Extract image URLs from Neynar embed objects
function extractImageUrls(embeds: Array<{ url?: string }>): string[] {
  return embeds
    .map((e) => e.url ?? "")
    .filter((url) => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return (
        lower.includes("imagedelivery.net") ||
        lower.includes("ipfs") ||
        lower.includes("imgur") ||
        lower.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/) !== null ||
        lower.includes("i.imgur") ||
        lower.includes("cdn.") ||
        lower.includes("images.")
      );
    });
}

async function reply(text: string, parentHash: string): Promise<void> {
  const signerUuid = process.env.BOT_SIGNER_UUID ?? "";
  if (!signerUuid) return;
  const trimmed = text.slice(0, 400);
  await publishReply({ text: trimmed, parentHash, signerUuid });
}

// Detect cancel intent — must be explicit to avoid accidental triggers
function isCancelRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower.includes("cancel bounty") ||
    lower.includes("cancel this bounty") ||
    lower.includes("cancel the bounty") ||
    lower.includes("cancel it") ||
    lower.includes("cancell") || // common typo
    (lower.includes("cancel") && lower.includes("refund")) ||
    (lower.includes("cancel") && lower.includes("bounty"))
  );
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

    // Store chain + amount only — uniqueAmount computed later in awaiting_bounty_type
    // (right before registerPendingPayment, so the pending count is accurate at that moment)
    const chainState = { ...state, step: "awaiting_bounty_type" as const, chain, amountEth: finalAmount };
    await setConversation(threadHash, chainState);

    return `got it — ${config.label}, ${finalAmount} ${config.currency}. open or solo bounty?\n\n• open (default) — anyone can contribute funds, community votes on the winner.\n• solo — only you decide the winner directly.\n\nreply "open" or "solo" (or just continue and i'll default to open).`;
  }

  // --- Step: awaiting_bounty_type ---
  if (state.step === "awaiting_bounty_type") {
    const parsed = parseBountyType(lower);

    // Rejections / explicit "no" → go back and ask again
    if (isRejection(lower) && !parsed) {
      return `open or solo? open = community vote, solo = you pick the winner directly.`;
    }

    // Default to "open" if user just says "go ahead", "ok", confirmation, or anything unclear
    const bountyType: "open" | "solo" = parsed ?? "open";

    const chain = state.chain ?? "arbitrum";
    const finalAmount = state.amountEth ?? CHAIN_CONFIG[chain as keyof typeof CHAIN_CONFIG].minAmount;
    const { total: totalWithFee, fee: feeAmount } = addPlatformFee(finalAmount);
    const config = CHAIN_CONFIG[chain as keyof typeof CHAIN_CONFIG];
    const walletAddress = getBotWalletAddress();

    const existingPending = (await getAllAwaitingPayment()).filter(p => (p.state.chain ?? "arbitrum") === chain);
    const uniqueAmount = makeUniqueAmount(totalWithFee, existingPending.length, chain === "degen");

    const updatedState = { ...state, step: "awaiting_payment" as const, chain: chain as "arbitrum" | "base" | "degen", amountEth: finalAmount, uniqueAmount, bountyType };
    await setConversation(threadHash, updatedState);

    if (!walletAddress) {
      return `${bountyType} bounty — ${config.label}, ${finalAmount} ${config.currency}. wallet not configured yet, check back soon.`;
    }

    await registerPendingPayment(threadHash, castHash, updatedState);

    const typeNote = bountyType === "solo" ? "you'll pick the winner directly." : `submissions stay open for ${MIN_OPEN_DURATION_HOURS}h before i pick a winner.`;
    return `${bountyType} bounty — send exactly ${uniqueAmount} ${config.currency} to ${walletAddress} on ${config.label} — ${finalAmount} bounty + ${feeAmount} platform fee (${PLATFORM_FEE_PCT}%). sending more won't increase the prize and won't be refunded. your wallet handles gas. once i see the deposit i'll create the bounty — ${typeNote}`;
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

  // --- Step: awaiting_cancel_confirmation ---
  if (state.step === "awaiting_cancel_confirmation") {
    // Only the original requester can confirm — ignore anyone else replying in the thread
    if (state.authorFid !== authorFid) return null;

    const bountyName = state.cancelBountyName ?? "this bounty";
    const bountyId = state.cancelBountyId;
    const bountyChain = state.cancelBountyChain ?? "arbitrum";

    if (isRejection(lower) || lower.includes("nevermind") || lower.includes("never mind") || lower.includes("keep it")) {
      await clearConversation(threadHash);
      return `ok, bounty stays open. good luck!`;
    }

    // Accept explicit double-confirmation to avoid accidental cancel
    const isYesCancel = (
      lower === "yes cancel" ||
      lower === "yes, cancel" ||
      lower.includes("yes cancel") ||
      lower.includes("confirm cancel") ||
      lower.includes("yes, cancel it") ||
      lower.includes("cancel confirmed") ||
      lower === "yes" ||
      lower === "y"
    );

    if (!isYesCancel) return null; // wait for a clear answer

    if (!bountyId) {
      await clearConversation(threadHash);
      return `can't find the bounty to cancel — contact support or try again.`;
    }

    try {
      // Look up creator FID so we can refund to their wallet
      // Also guard against double-execution: if already closed, don't cancel again
      const bountyRecord = await getActiveBounty(bountyId);
      if (bountyRecord?.status === "closed") {
        await clearConversation(threadHash);
        return `"${bountyName}" is already closed — nothing to cancel.`;
      }
      const creatorFid = bountyRecord?.creatorFid;
      // Use the stored bounty amount as the exact refund — this is what the creator put up
      // (bounty reward only, no fee). parseEther handles the string → wei conversion.
      const bountyAmountWei = bountyRecord?.amountEth ? parseEther(bountyRecord.amountEth) : undefined;

      const { cancelTxHash, refundTxHash, method, refundAddress, externalContributors } = await cancelBounty(BigInt(bountyId), bountyChain, creatorFid, bountyAmountWei);
      await updateBounty(bountyId, { status: "closed", winnerReasoning: "bounty cancelled by issuer" });
      await clearConversation(threadHash);

      const shortRefund = `${refundAddress.slice(0, 6)}...${refundAddress.slice(-4)}`;
      const chainCurrency = bountyChain === "degen" ? "DEGEN" : "ETH";
      const refundLine = refundTxHash
        ? `bounty amount sent to ${shortRefund}.`
        : `couldn't resolve your wallet — ${chainCurrency} is held safely in the bot wallet. DM to arrange your refund.`;

      if (method === "cancelOpenBounty" && externalContributors.length > 0) {
        // Resolve contributor addresses to @usernames and post a follow-up ping
        const usernameMap = await resolveAddressesToUsernames(externalContributors);
        const mentions = externalContributors
          .map((a) => usernameMap.get(a.toLowerCase()) ?? `${a.slice(0, 6)}...${a.slice(-4)}`)
          .join(" ");
        void (async () => {
          const signerUuid = process.env.BOT_SIGNER_UUID ?? "";
          if (signerUuid) {
            await publishReply({
              text: `heads up ${mentions} — this bounty was cancelled. go to poidh.xyz to claim your refund via "claim refund from cancelled bounty".`,
              parentHash: threadHash,
              signerUuid,
            }).catch((e) => console.error("[webhook] contributor ping failed:", e));
          }
        })();

        return `"${bountyName}" cancelled — ${refundLine} pinging contributors to claim their refunds on poidh.xyz. cancel tx: ${cancelTxHash.slice(0, 18)}...`;
      }

      return `"${bountyName}" cancelled — ${refundLine} tx: ${cancelTxHash.slice(0, 18)}...`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await clearConversation(threadHash);

      if (msg.toLowerCase().includes("voting") || msg.toLowerCase().includes("vote")) {
        return `can't cancel right now — a community vote is in progress. wait for the vote to resolve first, then try again.`;
      }
      return `cancel failed: ${msg.slice(0, 150)}`;
    }
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

  // Extract image URLs from the triggering cast's embeds (inline — no extra API call)
  const castImageUrls = extractImageUrls(payload.data.embeds ?? []);

  // Atomic DB dedup — works across all serverless instances
  const isNew = await markCastProcessed(hash);
  if (!isNew) return NextResponse.json({ ok: true, skipped: "duplicate" });

  // Prune old entries occasionally (1% of requests) to keep table lean
  if (Math.random() < 0.01) void pruneProcessedCasts();

  const mentioned = isBotMentioned(payload);

  // Check active thread by thread_hash OR parent_hash — parallel DB lookups
  // fetchParentCastInfo combines isReplyToBot + parent image extraction in one API call
  const [threadActive, parentActive, bountyThread, parentInfo] = await Promise.all([
    isInActiveThread(thread_hash),
    parent_hash ? isInActiveThread(parent_hash) : Promise.resolve(false),
    getBountyThread(thread_hash),
    fetchParentCastInfo(parent_hash),
  ]);

  const replyToBot = parentInfo.isFromBot;
  // Combine image URLs from both current cast and parent cast (parent first — that's usually the submission)
  const imageUrls = [...parentInfo.imageUrls, ...castImageUrls].filter(
    (url, i, arr) => arr.indexOf(url) === i, // deduplicate
  );

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
    // Cancel request: user explicitly mentions bot + "cancel bounty" in the bounty thread
    if (inBountyThread && bountyThread && mentioned && isCancelRequest(text)) {
      // Check if already closed before starting the confirmation flow
      const existingBounty = await getActiveBounty(bountyThread.bountyId);
      if (existingBounty?.status === "closed") {
        logEntry.action = "cancel_already_closed";
        logEntry.replyText = "already closed";
        await reply(`"${bountyThread.bountyName}" is already closed — nothing to cancel.`, hash);
        await appendLog(logEntry);
        return NextResponse.json({ ok: true });
      }

      // Only the bounty creator can cancel — reject everyone else.
      // creatorFid may be null for bounties created before this field was added.
      // In that case we can't verify ownership — block the cancel and ask them to DM.
      if (!existingBounty?.creatorFid) {
        logEntry.action = "cancel_no_creator_fid";
        logEntry.replyText = "no creator fid on record";
        const ownerHandle = process.env.BOT_OWNER_HANDLE ?? "0x94t3z.eth";
        await reply(`this bounty was created before creator tracking was added — can't verify ownership automatically. DM @${ownerHandle} to arrange a manual cancel and refund.`, hash);
        await appendLog(logEntry);
        return NextResponse.json({ ok: true });
      }

      if (existingBounty.creatorFid !== author.fid) {
        logEntry.action = "cancel_unauthorized";
        logEntry.replyText = "not creator";
        await reply(`only the person who created this bounty can cancel it.`, hash);
        await appendLog(logEntry);
        return NextResponse.json({ ok: true });
      }

      const cancelState = {
        step: "awaiting_cancel_confirmation" as const,
        authorFid: author.fid,
        authorUsername: author.username,
        cancelBountyId: bountyThread.bountyId,
        cancelBountyChain: bountyThread.chain,
        cancelBountyName: bountyThread.bountyName,
        lastUpdated: new Date().toISOString(),
      };
      await setConversation(thread_hash, cancelState);
      if (hash !== thread_hash) await setConversation(hash, cancelState);

      const cancelReply = `you want to cancel "${bountyThread.bountyName}"? this will close the bounty and refund the bounty amount to your wallet. reply "yes cancel" to confirm or "no" to keep it open.`;
      logEntry.action = "cancel_bounty_confirmation";
      logEntry.replyText = cancelReply;
      await reply(cancelReply, hash);
      await appendLog(logEntry);
      return NextResponse.json({ ok: true });
    }

    if (replyToBot || (inBountyThread && bountyThread)) {
      const agentResult = await runAgent({
        castHash: hash,
        threadHash: thread_hash,
        authorUsername: author.username,
        authorFid: author.fid,
        castText: text,
        action: "general_reply",
        replyToBot,
        mentioned,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        bountyContext: bountyThread ? await (async () => {
          // Pull allEvalResults from the bounty record so the bot can explain rejections in thread
          let allEvalResults: Array<{ claimId: string; score: number; valid: boolean; reasoning: string }> | undefined;
          try {
            const bountyRecord = await getActiveBounty(bountyThread.bountyId);
            allEvalResults = bountyRecord?.allEvalResults ?? undefined;
          } catch { /* non-critical */ }
          return {
            bountyId: bountyThread.bountyId,
            name: bountyThread.bountyName,
            description: bountyThread.bountyDescription,
            chain: bountyThread.chain,
            poidhUrl: bountyThread.poidhUrl,
            winnerClaimId: bountyThread.winnerClaimId,
            winnerIssuer: bountyThread.winnerIssuer,
            winnerReasoning: bountyThread.winnerReasoning,
            allEvalResults,
          };
        })() : undefined,
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
      mentioned,
      imageUrls: imageUrls.length ? imageUrls : undefined,
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
