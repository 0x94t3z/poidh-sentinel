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
import {
  cancelBounty,
  getBountyDetails,
  getTxExplorerUrl,
  retryCancelledBountyRefundFromPending,
} from "@/features/bot/poidh-contract";
import { resolveAddressesToUsernames, MIN_OPEN_DURATION_HOURS } from "@/features/bot/bounty-loop";
import type { WebhookPayload, BotLogEntry } from "@/features/bot/types";

const BOT_FID = parseInt(process.env.BOT_FID ?? "0", 10);
if (!Number.isFinite(BOT_FID) || BOT_FID <= 0) {
  console.warn("[webhook] BOT_FID is missing/invalid — self-cast protections may not work correctly");
}

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
  text: string;
}> {
  if (!parentHash) return { isFromBot: false, imageUrls: [], text: "" };
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return { isFromBot: false, imageUrls: [], text: "" };
  try {
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/cast?identifier=${parentHash}&type=hash`,
      { headers: { "x-api-key": apiKey } },
    );
    if (!res.ok) return { isFromBot: false, imageUrls: [], text: "" };
    const data = (await res.json()) as {
      cast?: {
        author?: { fid?: number };
        embeds?: Array<{ url?: string }>;
        text?: string;
      };
    };
    const cast = data.cast;
    const isFromBot = cast?.author?.fid === BOT_FID;
    const imageUrls = extractImageUrls(cast?.embeds ?? []);
    return { isFromBot, imageUrls, text: cast?.text ?? "" };
  } catch {
    return { isFromBot: false, imageUrls: [], text: "" };
  }
}

function inferSuggestedIdeaFromParentText(parentText: string, authorUsername: string): { name: string; description: string } {
  const cleaned = parentText
    .replace(/\s*want me to create.*$/i, "")
    .replace(/\s*reply with.*$/i, "")
    .trim();

  if (!cleaned) {
    return {
      name: `bounty by @${authorUsername}`.slice(0, 80),
      description: "real-world bounty idea from thread context",
    };
  }

  // Prefer the short phrase before em-dash/colon as the title, and keep it word-safe.
  const lead = cleaned
    .split(/[—:]/)[0]
    .split(/[.!?]/)[0]
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  const words = lead.split(" ").filter(Boolean).slice(0, 12);
  let name = words.join(" ").slice(0, 72).trim();
  if (name.length === 72 && name.includes(" ")) {
    name = name.slice(0, name.lastIndexOf(" ")).trim();
  }
  if (name.endsWith("-")) name = name.slice(0, -1).trim();

  const description = /proof must be/i.test(cleaned)
    ? cleaned
    : `${cleaned} proof must be original and unedited.`;

  return {
    name: name || `bounty by @${authorUsername}`.slice(0, 80),
    description: description.slice(0, 500),
  };
}

function isRecoverableCreationPrompt(parentText: string): boolean {
  const lower = parentText.toLowerCase();
  return (
    lower.includes("want me to create this on-chain") ||
    lower.includes("want me to create it on-chain") ||
    lower.includes("want me to post this as a bounty") ||
    lower.includes("reply yes to continue") ||
    lower.includes("reply yes to proceed")
  );
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

function extractTxHash(input: string): `0x${string}` | null {
  const match = input.match(/0x[a-fA-F0-9]{64}/);
  return (match?.[0] as `0x${string}`) ?? null;
}

async function reply(text: string, parentHash: string): Promise<void> {
  const signerUuid = process.env.BOT_SIGNER_UUID ?? "";
  if (!signerUuid) return;
  const trimmed = text.slice(0, 1024);
  await publishReply({ text: trimmed, parentHash, signerUuid });
}

// Resolve a FID to the best available ETH address for refunds.
// Prefers first verified ETH address, falls back to custody address.
// Returns null if neither is available — caller must block the operation.
async function resolveFidToRefundAddress(fid: number): Promise<string | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      users?: Array<{
        custody_address?: string;
        verified_addresses?: { eth_addresses?: string[] };
      }>;
    };
    const user = data.users?.[0];
    if (!user) return null;
    return user.verified_addresses?.eth_addresses?.[0] ?? user.custody_address ?? null;
  } catch {
    return null;
  }
}


// Detect cancel intent — in a bounty thread context, be generous: any "cancel" signal counts.
// The creator confirmation step acts as the safety gate, not this detector.
function isCancelRequest(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "refund" ||
    lower === "retry refund" ||
    lower === "refund retry" ||
    lower.includes("please refund") ||
    lower.includes("refund please") ||
    lower.includes("cancel bounty") ||
    lower.includes("cancel this bounty") ||
    lower.includes("cancel the bounty") ||
    lower.includes("cancell bounty") || // common typo
    lower.includes("cancel it") ||
    lower.includes("cancel pls") ||
    lower.includes("pls cancel") ||
    lower.includes("please cancel") ||
    lower.includes("want to cancel") ||
    lower.includes("wanna cancel") ||
    (lower.includes("cancel") && lower.includes("refund")) ||
    (lower.startsWith("cancel") && lower.includes("bounty")) ||
    (lower.includes("bounty") && lower.includes("cancel"))
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
  mentioned: boolean,
): Promise<string | null> {
  const state = await getConversation(threadHash);
  if (!state) return null;

  // Only respond to the same user who started the conversation
  if (state.authorFid !== authorFid) return null;

  const lower = text.toLowerCase();

  // --- Step: awaiting_confirmation ---
  if (state.step === "awaiting_confirmation") {
    if (await isConfirmation(text)) {
      // Bonus: if they also mentioned a chain + amount in the same message, skip ahead
      const earlyChain = await parseChain(text);
      const earlyAmount = await parseAmount(text);
      if (earlyChain) {
        const config = CHAIN_CONFIG[earlyChain];
        const finalAmount = earlyAmount ?? config.minAmount;
        const numAmount = parseFloat(finalAmount);
        if (numAmount < parseFloat(config.minAmount)) {
          await setConversation(threadHash, { ...state, step: "awaiting_chain" });
          return `nice! minimum for ${config.label} is ${config.minAmount} ${config.currency} — want to go with that?`;
        }
        const chainState = { ...state, step: "awaiting_bounty_type" as const, chain: earlyChain, amountEth: finalAmount };
        await setConversation(threadHash, chainState);
        return `nice! ${config.label}, ${finalAmount} ${config.currency}. open or solo bounty?\n\n• open (default) — anyone can contribute funds, community votes on the winner.\n• solo — only you decide the winner directly.\n\nreply "open" or "solo" (or just continue and i'll default to open).`;
      }
      await setConversation(threadHash, { ...state, step: "awaiting_chain" });
      return `nice! which chain — arbitrum, base, or degen? and how much do you want to put up? minimums: arbitrum/base = 0.001 ETH, degen = 1000 DEGEN.`;
    }

    if (await isRejection(text)) {
      await clearConversation(threadHash);
      return "no worries — mention me anytime if you want a different idea.";
    }

    // Not a clear yes or no — only re-prompt if they explicitly @mentioned the bot,
    // otherwise stay silent (they might just be chatting in the thread)
    if (!mentioned) return null;
    const ideaName = state.suggestedIdea?.name ?? "the idea";
    return `still waiting on you — want to create a bounty for "${ideaName}"? reply yes to continue or no to cancel.`;
  }

  // --- Step: awaiting_chain ---
  if (state.step === "awaiting_chain") {
    const [chain, amount] = await Promise.all([parseChain(text), parseAmount(text)]);

    if (!chain) {
      // Re-prompt only if they @mentioned the bot OR it looks like a chain answer attempt
      if (!mentioned && !looksLikeChainAnswer(lower)) return null;
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
    const [parsed, rejected] = await Promise.all([parseBountyType(text), isRejection(text)]);

    // Rejections / explicit "no" → go back and ask again
    if (rejected && !parsed) {
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
    const paymentSent =
      lower.includes("sent") || lower.includes("done") || lower.includes("transferred") ||
      lower.includes("paid") || lower.includes("funded") ||
      await isConfirmation(text); // catches "I did it", "all good", "went through", etc.
    if (paymentSent) {
      return `got it — checking for the deposit now. once confirmed on-chain i'll create the bounty and post the link here. usually takes a minute or two.`;
    }
    // Re-prompt only if they explicitly @mentioned the bot
    if (!mentioned) return null;
    const chain = state.chain ?? "arbitrum";
    const config = CHAIN_CONFIG[chain as keyof typeof CHAIN_CONFIG];
    const uniqueAmt = state.uniqueAmount ?? state.amountEth ?? config.minAmount;
    const walletAddress = getBotWalletAddress();
    return `still waiting on the deposit — send exactly ${uniqueAmt} ${config.currency} to ${walletAddress} on ${config.label}. reply "sent" once it's done.`;
  }

  // --- Step: awaiting_cancel_confirmation ---
  if (state.step === "awaiting_cancel_confirmation") {
    // Only the original requester can confirm — ignore anyone else replying in the thread
    if (state.authorFid !== authorFid) return null;

    const bountyName = state.cancelBountyName ?? "this bounty";
    const bountyId = state.cancelBountyId;
    const bountyChain = state.cancelBountyChain ?? "arbitrum";

    const cancelRejected =
      /^(no|n|nope|nah)[\s!,.]*$/.test(lower) ||
      lower.includes("nevermind") ||
      lower.includes("never mind") ||
      lower.includes("keep it") ||
      lower.includes("keep it open") ||
      lower.includes("don't cancel") ||
      lower.includes("do not cancel");

    if (cancelRejected) {
      await clearConversation(threadHash);
      return `ok, bounty stays open. good luck!`;
    }

    // Cancel confirmation is safety-critical: use deterministic parsing only.
    // Accept either "yes cancel" (preferred) or a plain "yes" at this step.
    const isYesCancel =
      /^(yes|y|confirm|confirmed|proceed|ok|okay|do it)(\s+cancel)?[\s!,.]*$/.test(lower) ||
      ((lower.includes("yes") || lower.includes("confirm")) && lower.includes("cancel"));

    if (!isYesCancel) {
      // Re-prompt only if they explicitly @mentioned the bot, otherwise stay silent
      if (!mentioned) return null;
      return `reply "yes cancel" to confirm cancelling "${bountyName}", or "no" to keep it open.`;
    }

    if (!bountyId) {
      await clearConversation(threadHash);
      return `can't find the bounty to cancel — contact support or try again.`;
    }

    try {
      // Use the pre-resolved refund address stored during the confirmation prompt.
      // This was already validated — if it was missing we blocked the cancel earlier.
      const preResolvedAddress = state.cancelRefundAddress ?? null;

      const bountyRecord = await getActiveBounty(bountyId);
      if (bountyRecord?.status === "closed") {
        const lookedCancelled = (bountyRecord.winnerReasoning ?? "").toLowerCase().includes("cancelled");
        const hasRecordedRefundTx = !!bountyRecord.winnerTxHash;
        const refundPendingMarker = (bountyRecord.winnerReasoning ?? "").toLowerCase().includes("refund pending");
        if (!lookedCancelled) {
          await clearConversation(threadHash);
          return `"${bountyName}" is already closed — nothing to cancel.`;
        }

        if (hasRecordedRefundTx) {
          await clearConversation(threadHash);
          const explorer = getTxExplorerUrl(bountyChain, bountyRecord.winnerTxHash as `0x${string}`);
          return `"${bountyName}" is already cancelled and refunded.\n\n${explorer}`;
        }

        // Safety guard: if we don't have an explicit "refund pending" marker, avoid
        // auto-sending again to prevent accidental double refund on legacy rows.
        if (!refundPendingMarker) {
          await clearConversation(threadHash);
          const ownerHandle = process.env.BOT_OWNER_HANDLE ?? "0x94t3z.eth";
          return `"${bountyName}" is already cancelled, but refund state is not marked pending. to avoid double send, auto-retry is blocked. DM @${ownerHandle} for manual verification.`;
        }

        const bountyAmountWei = bountyRecord.amountEth ? parseEther(bountyRecord.amountEth) : undefined;
        if (!bountyAmountWei) {
          await clearConversation(threadHash);
          return `this bounty is already cancelled, but refund retry could not run (missing bounty amount). DM @${process.env.BOT_OWNER_HANDLE ?? "0x94t3z.eth"} with this cast hash.`;
        }

        try {
          const retry = await retryCancelledBountyRefundFromPending(
            BigInt(bountyId),
            bountyChain,
            preResolvedAddress ?? "",
            bountyAmountWei,
          );
          await clearConversation(threadHash);
          if (retry.refundTxHash) {
            await updateBounty(bountyId, {
              winnerTxHash: retry.refundTxHash,
              winnerReasoning: `bounty cancelled by @${state.authorUsername} (refund sent)`,
            }).catch(() => {});
            const explorer = getTxExplorerUrl(bountyChain, retry.refundTxHash);
            return `this bounty was already cancelled, but i retried the refund and sent it now.\n\n${explorer}`;
          }
          return `"${bountyName}" is already cancelled and no pending refund was found to retry.`;
        } catch (retryErr) {
          const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          const ownerHandle = process.env.BOT_OWNER_HANDLE ?? "0x94t3z.eth";
          const txHashInError = extractTxHash(msg);
          const txLink = txHashInError ? `\n\n${getTxExplorerUrl(bountyChain, txHashInError)}` : "";
          await clearConversation(threadHash);
          return `this bounty is already cancelled, but refund retry failed: ${msg.slice(0, 120)}. DM @${ownerHandle} and include this cast hash.${txLink}`;
        }
      }
      // Use the stored bounty amount as the exact refund — this is what the creator put up
      // (bounty reward only, no fee). parseEther handles the string → wei conversion.
      const bountyAmountWei = bountyRecord?.amountEth ? parseEther(bountyRecord.amountEth) : undefined;
      // Pass DB bountyType so cancelBounty can use it as fallback if everHadExternalContributor fails
      const bountyType = bountyRecord?.bountyType ?? null;

      const { cancelTxHash, refundTxHash, method, refundAddress, externalContributors } = await cancelBounty(BigInt(bountyId), bountyChain, preResolvedAddress, bountyAmountWei, bountyType);
      await updateBounty(bountyId, {
        status: "closed",
        winnerReasoning: refundTxHash
          ? `bounty cancelled by @${state.authorUsername} (refund sent)`
          : `bounty cancelled by @${state.authorUsername} (refund pending)`,
        winnerTxHash: refundTxHash ?? undefined,
      });
      await clearConversation(threadHash);

      const shortRefund = `${refundAddress.slice(0, 6)}...${refundAddress.slice(-4)}`;
      const chainCurrency = bountyChain === "degen" ? "DEGEN" : "ETH";
      const cancelExplorerUrl = getTxExplorerUrl(bountyChain, cancelTxHash);
      const refundLine = refundTxHash
        ? `bounty amount sent to ${shortRefund}.`
        : `${chainCurrency} held in bot wallet — DM to arrange refund.`;

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

        return `"${bountyName}" cancelled — ${refundLine} pinging contributors to claim their refunds on poidh.xyz.\n\n${cancelExplorerUrl}`;
      }

      return `"${bountyName}" cancelled — ${refundLine}\n\n${cancelExplorerUrl}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const lowerMsg = msg.toLowerCase();

      // If a post-cancel step fails (e.g. claimRefundFromCancelledOpenBounty),
      // verify the bounty's on-chain terminal state before reporting failure.
      try {
        if (bountyId) {
          const details = await getBountyDetails(BigInt(bountyId), bountyChain);
          const wasClosedOnChain = details.claimer !== "0x0000000000000000000000000000000000000000";
          const wasCancelledOnChain = wasClosedOnChain &&
            details.claimer.toLowerCase() === details.issuer.toLowerCase();

          if (wasCancelledOnChain) {
            await updateBounty(bountyId, {
              status: "closed",
              winnerReasoning: lowerMsg.includes("exceeds the balance")
                ? `bounty cancelled by @${state.authorUsername} (refund pending - low gas)`
                : `bounty cancelled by @${state.authorUsername} (refund pending)`,
            }).catch(() => {});
            await clearConversation(threadHash);

            const ownerHandle = process.env.BOT_OWNER_HANDLE ?? "0x94t3z.eth";
            if (lowerMsg.includes("exceeds the balance")) {
              return `bounty is cancelled on-chain, but refund transfer failed due to low bot gas reserve. DM @${ownerHandle} and include this cast hash for immediate retry.`;
            }
            return `bounty is already cancelled on-chain, but the refund step hit an error. if funds don't arrive soon, DM @${ownerHandle} and include this: ${msg.slice(0, 120)}`;
          }
        }
      } catch {
        // non-critical fallback — preserve original error handling below
      }

      await clearConversation(threadHash);
      if (lowerMsg.includes("voting") || lowerMsg.includes("vote")) {
        return `can't cancel right now — a community vote is in progress. wait for the vote to resolve first, then try again.`;
      }
      const txHashInError = extractTxHash(msg);
      const txLink = txHashInError ? `\n\n${getTxExplorerUrl(bountyChain, txHashInError)}` : "";
      return `cancel failed: ${msg.slice(0, 150)}${txLink}`;
    }
  }

  // Unknown step — re-prompt only if they explicitly @mentioned the bot
  if (!mentioned) return null;
  return `still here — just reply to continue where we left off.`;
}

// Check active thread — async now since getConversation hits DB
async function isInActiveThread(threadHash: string): Promise<boolean> {
  const state = await getConversation(threadHash);
  return !!state;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const botEnabled = (process.env.BOT_ENABLED ?? "true").toLowerCase() !== "false";
  if (!botEnabled) {
    return NextResponse.json({ ok: true, paused: true, reason: "BOT_ENABLED=false" });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
  }

  const webhookSecret = process.env.NEYNAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: NEYNAR_WEBHOOK_SECRET is required in production" },
        { status: 500 },
      );
    }
    console.warn("[webhook] NEYNAR_WEBHOOK_SECRET missing in non-production — signature verification disabled");
  } else {
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
      const state = await getConversation(activeThreadKey);

      // If a different user explicitly mentions the bot in someone else's active conversation,
      // acknowledge them and invite them to start their own — don't leave them hanging.
      if (state && state.authorFid !== author.fid && mentioned) {
        const botUsername = process.env.BOT_USERNAME ?? "poidh-sentinel";
        const nudge = `hey @${author.username}! there's already a bounty conversation going here. mention me in your own cast and i'll help you create one too — @${botUsername}`;
        logEntry.action = "third_party_nudge";
        logEntry.replyText = nudge;
        await reply(nudge, hash);
        await appendLog(logEntry);
        return NextResponse.json({ ok: true });
      }

      const flowReply = await handleConversationFlow(
        activeThreadKey, hash, text, author.fid, author.username, mentioned,
      );

      if (flowReply !== null) {
        logEntry.action = "conversation_flow";
        logEntry.replyText = flowReply;
        await reply(flowReply, hash);
        await appendLog(logEntry);
        return NextResponse.json({ ok: true });
      }
      // Never fall through to the agent when a conversation is in progress
      console.log(`[webhook] silent — in active thread but no flow match (step=${state?.step})`);
      return NextResponse.json({ ok: true, skipped: "unrelated thread reply" });
    }

    // --- Priority 2: direct reply to one of the bot's casts OR bounty thread ---
    // Cancel request: creator says "cancel bounty" in the bounty thread — @mention not required
    // since the bot is already monitoring all replies in bounty threads
    if (inBountyThread && bountyThread && isCancelRequest(text)) {
      const existingBounty = await getActiveBounty(bountyThread.bountyId);

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

      // Resolve refund address NOW — before asking for confirmation.
      // If we can't resolve it we block the cancel rather than risk sending to the bot wallet.
      const resolvedRefundAddress = await resolveFidToRefundAddress(author.fid);
      if (!resolvedRefundAddress) {
        const ownerHandle = process.env.BOT_OWNER_HANDLE ?? "0x94t3z.eth";
        logEntry.action = "cancel_no_refund_address";
        logEntry.replyText = "could not resolve refund address";
        await reply(`couldn't resolve your wallet address — can't safely send the refund. DM @${ownerHandle} to arrange a manual cancel and refund.`, hash);
        await appendLog(logEntry);
        return NextResponse.json({ ok: true });
      }

      const shortRefund = `${resolvedRefundAddress.slice(0, 6)}...${resolvedRefundAddress.slice(-4)}`;
      const cancelState = {
        step: "awaiting_cancel_confirmation" as const,
        authorFid: author.fid,
        authorUsername: author.username,
        cancelBountyId: bountyThread.bountyId,
        cancelBountyChain: bountyThread.chain,
        cancelBountyName: bountyThread.bountyName,
        cancelRefundAddress: resolvedRefundAddress,
        lastUpdated: new Date().toISOString(),
      };
      await setConversation(thread_hash, cancelState);
      if (hash !== thread_hash) await setConversation(hash, cancelState);

      const isAlreadyClosed = existingBounty?.status === "closed";
      const lookedCancelled = (existingBounty?.winnerReasoning ?? "").toLowerCase().includes("cancelled");
      const cancelReply = isAlreadyClosed && lookedCancelled
        ? `"${bountyThread.bountyName}" is already cancelled. retry refund to ${shortRefund}? reply "yes cancel" to confirm or "no" to skip.`
        : `you want to cancel "${bountyThread.bountyName}"? refund will go to ${shortRefund}. reply "yes cancel" to confirm or "no" to keep it open.`;
      logEntry.action = "cancel_bounty_confirmation";
      logEntry.replyText = cancelReply;
      await reply(cancelReply, hash);
      await appendLog(logEntry);
      return NextResponse.json({ ok: true });
    }

    // Recovery path:
    // If user confirms ("yes"/"ok"/etc.) directly under a bot proposal but the conversation
    // state was lost/cleared, rebuild state and continue deterministic chain+amount flow.
    if (
      replyToBot &&
      !inBountyThread &&
      !inActiveThread &&
      await isConfirmation(text) &&
      isRecoverableCreationPrompt(parentInfo.text)
    ) {
      const recoveredState = {
        step: "awaiting_chain" as const,
        authorFid: author.fid,
        authorUsername: author.username,
        suggestedIdea: inferSuggestedIdeaFromParentText(parentInfo.text, author.username),
        lastUpdated: new Date().toISOString(),
      };
      await setConversation(thread_hash, recoveredState);
      if (hash !== thread_hash) await setConversation(hash, recoveredState);

      const flowReply = `nice! which chain — arbitrum, base, or degen? and how much do you want to put up? minimums: arbitrum/base = 0.001 ETH, degen = 1000 DEGEN.`;
      logEntry.action = "conversation_recovered";
      logEntry.replyText = flowReply;
      await reply(flowReply, hash);
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

      // If user intentionally starts a new bounty flow from an existing thread/reply,
      // persist state here as well (same as fresh mention path).
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
