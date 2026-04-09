import "server-only";
import { createPublicClient, http, formatEther, parseEther } from "viem";
import { arbitrum, base, degen } from "viem/chains";
import { getBotWalletAddress, createBountyOnChain, resolvePoidhUrl } from "@/features/bot/poidh-contract";
import { MIN_OPEN_DURATION_HOURS } from "@/features/bot/constants";
import { setConversation, clearConversation, CHAIN_CONFIG, PLATFORM_FEE_PCT } from "@/features/bot/conversation-state";
import { addActiveBounty } from "@/features/bot/bounty-store";
import { publishReply, publishCast } from "@/features/bot/cast-reply";
import { getWalletBalance, setWalletBalance, getAllAwaitingPayment, unregisterPendingPayment, registerBountyThread, updateBounty } from "@/db/actions/bot-actions";

function buildExplorerUrl(chain: string, txHash: string): string {
  const explorerMap: Record<string, string> = {
    arbitrum: "https://arbiscan.io/tx",
    base: "https://basescan.org/tx",
    degen: "https://explorer.degen.tips/tx",
  };
  return `${explorerMap[chain] ?? "https://arbiscan.io/tx"}/${txHash}`;
}

function getViemChainConfig(chain: string) {
  if (chain === "base") return { viemChain: base, rpcUrl: process.env.BASE_RPC_URL ?? "https://mainnet.base.org" };
  if (chain === "degen") return { viemChain: degen, rpcUrl: process.env.DEGEN_RPC_URL ?? "https://rpc.degen.tips" };
  return { viemChain: arbitrum, rpcUrl: process.env.ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc" };
}

async function getOnChainBalance(chain: string, address: string): Promise<bigint> {
  const { viemChain, rpcUrl } = getViemChainConfig(chain);
  const client = createPublicClient({
    chain: viemChain,
    transport: http(rpcUrl),
  });
  return client.getBalance({ address: address as `0x${string}` });
}

// Cron lock — prevents two simultaneous runs from double-processing
let isRunning = false;

export async function checkDepositsAndCreateBounties(): Promise<void> {
  if (isRunning) {
    console.log("[deposit-checker] skipping — already running");
    return;
  }
  isRunning = true;
  try {
    await _checkDeposits();
  } finally {
    isRunning = false;
  }
}

async function _checkDeposits(): Promise<void> {
  const walletAddress = getBotWalletAddress();
  if (!walletAddress || walletAddress === "not configured") return;

  const signerUuid = process.env.BOT_SIGNER_UUID ?? "";
  if (!signerUuid) return;

  const pending = await getAllAwaitingPayment();
  console.log(`[deposit-checker] checking ${pending.length} pending payment(s)`);
  if (pending.length === 0) return;

  // Fetch current on-chain balances once per chain
  const chainBalances = new Map<string, bigint>();
  for (const { state } of pending) {
    const chain = state.chain ?? "arbitrum";
    if (!chainBalances.has(chain)) {
      const bal = await getOnChainBalance(chain, walletAddress).catch(() => BigInt(0));
      chainBalances.set(chain, bal);
    }
  }

  const claimedThisRun = new Map<string, bigint>();

  for (const { threadHash, castHash, state } of pending) {
    const chain = state.chain ?? "arbitrum";

    const balanceKey = `${chain}:${walletAddress}`;
    const currentBalance = chainBalances.get(chain) ?? BigInt(0);
    const lastBalance = await getWalletBalance(balanceKey);
    const alreadyClaimed = claimedThisRun.get(chain) ?? BigInt(0);
    const availableBalance = currentBalance - alreadyClaimed;

    // requestedAmount = intended bounty size (used for on-chain creation + announcement)
    // matchingAmount  = what we expect to receive (uniqueAmount if set, else requestedAmount)
    const requestedAmount = state.amountEth ?? CHAIN_CONFIG[chain].minAmount;
    const matchingAmount = state.uniqueAmount ?? requestedAmount;
    const requiredWei = parseEther(matchingAmount);

    console.log(`[deposit-checker] thread=${threadHash.slice(0,10)} balance=${formatEther(currentBalance)} last=${formatEther(lastBalance)} available=${formatEther(availableBalance)} required=${formatEther(requiredWei)} matching=${matchingAmount} requested=${requestedAmount}`);

    const sufficient = availableBalance >= requiredWei * 95n / 100n;

    if (!sufficient) {
      // Update stored balance so we can detect future increases
      if (currentBalance !== lastBalance) {
        await setWalletBalance(balanceKey, currentBalance);
        // If balance increased but still not enough, notify user
        if (currentBalance > lastBalance) {
          const depositEth = formatEther(currentBalance - lastBalance);
          const config = CHAIN_CONFIG[chain as keyof typeof CHAIN_CONFIG];
          const curr = config?.currency ?? "ETH";
          await publishReply({
            text: `received ${depositEth} ${curr} — still need ${formatEther(requiredWei - (currentBalance - lastBalance))} more. target is ${matchingAmount} ${curr} (${requestedAmount} bounty + ${PLATFORM_FEE_PCT}% fee). send the rest and i'll create the bounty.`,
            parentHash: castHash,
            signerUuid,
          });
        }
      }
      continue;
    }

    claimedThisRun.set(chain, alreadyClaimed + requiredWei);

    const idea = state.suggestedIdea ?? {
      name: "real-world photo bounty",
      description: "take a photo completing a real-world challenge. must be original and unedited.",
    };

    try {
      await setConversation(threadHash, { ...state, step: "creating_bounty" });

      const { txHash, bountyId } = await createBountyOnChain(
        idea.name,
        idea.description,
        requestedAmount,
        chain,
        state.bountyType ?? "open",
      );

      const resolvedBountyId = bountyId ?? `pending-${txHash.slice(0, 10)}`;

      await addActiveBounty({
        bountyId: resolvedBountyId,
        txHash,
        name: idea.name,
        description: idea.description,
        amountEth: requestedAmount,
        chain,
        createdAt: new Date().toISOString(),
        castHash,
        creatorFid: state.authorFid,
        bountyType: state.bountyType ?? "open",
        status: "open",
        claimCount: 0,
      });

      await clearConversation(threadHash);
      await unregisterPendingPayment(threadHash);
      await setWalletBalance(balanceKey, currentBalance);

      const config = CHAIN_CONFIG[chain];

      if (bountyId) {
        // We have a confirmed bounty ID — use the real poidh.xyz link (with chain offset)
        const poidhUrl = resolvePoidhUrl(chain, bountyId);

        await publishReply({
          text: `bounty is live — ${poidhUrl}`,
          parentHash: castHash,
          signerUuid,
          embedUrl: poidhUrl,
        });

        const isSolo = state.bountyType === "solo";
        const bountyLabel = isSolo ? "solo bounty" : "open bounty";
        const submissionNote = isSolo
          ? `submissions open for ${MIN_OPEN_DURATION_HOURS}h — winner chosen directly by the creator.`
          : `submissions open for ${MIN_OPEN_DURATION_HOURS}h — anyone can submit proof or add funds. winner chosen by vote.`;
        const channelAnnouncement = `new ${bountyLabel}: "${idea.name}"\n\n${idea.description}\n\nreward: ${requestedAmount} ${config.currency} on ${config.label}. ${submissionNote}\n\nto cancel this bounty, reply "cancel bounty" and tag @${process.env.BOT_USERNAME ?? "poidh-sentinel"}.`;
        const announcementHash = await publishCast({
          text: channelAnnouncement.slice(0, 1024),
          signerUuid,
          channelId: "poidh",
          embedUrl: poidhUrl,
        });

        // Save announcement hash on the bounty record for backfill recovery
        await updateBounty(resolvedBountyId, { announcementCastHash: announcementHash });

        // Register the announcement cast so the bot responds to replies in that thread
        await registerBountyThread({
          castHash: announcementHash,
          bountyId: resolvedBountyId,
          bountyName: idea.name,
          bountyDescription: idea.description,
          chain,
          poidhUrl,
        });
      } else {
        // bountyId not resolved yet — post plain text with tx hash, no embed
        const explorerUrl = buildExplorerUrl(chain, txHash);
        await publishReply({
          text: `bounty tx confirmed — waiting for id to resolve. tx: ${explorerUrl}`,
          parentHash: castHash,
          signerUuid,
        });

        const isSoloFallback = state.bountyType === "solo";
        const bountyLabelFallback = isSoloFallback ? "solo bounty" : "open bounty";
        const submissionNoteFallback = isSoloFallback
          ? `submissions open for ${MIN_OPEN_DURATION_HOURS}h — winner chosen directly by the creator.`
          : `submissions open for ${MIN_OPEN_DURATION_HOURS}h — anyone can submit proof or add funds. winner chosen by vote.`;
        const channelAnnouncement = `new ${bountyLabelFallback}: "${idea.name}"\n\n${idea.description}\n\nreward: ${requestedAmount} ${config.currency} on ${config.label}. ${submissionNoteFallback}\n\nto cancel this bounty, reply "cancel bounty" and tag @${process.env.BOT_USERNAME ?? "poidh-sentinel"}. tx: ${explorerUrl}`;
        const announcementHash = await publishCast({
          text: channelAnnouncement.slice(0, 1024),
          signerUuid,
          channelId: "poidh",
          // no embedUrl — don't embed an explorer link as if it's the bounty page
        });

        // Save announcement hash and register thread even without a resolved bountyId
        await updateBounty(resolvedBountyId, { announcementCastHash: announcementHash });
        await registerBountyThread({
          castHash: announcementHash,
          bountyId: resolvedBountyId,
          bountyName: idea.name,
          bountyDescription: idea.description,
          chain,
        });

        console.warn(`[deposit-checker] bountyId not resolved for tx ${txHash} on ${chain} — no poidh embed posted`);
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[deposit-checker] bounty creation failed:", msg);
      await setConversation(threadHash, { ...state, step: "awaiting_payment" });
      await publishReply({
        text: `funds received but bounty creation hit an error: ${msg.slice(0, 150)}. i'll retry shortly.`,
        parentHash: castHash,
        signerUuid,
      });
    }
  }
}
