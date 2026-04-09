import { NextResponse } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { activeBounties } from "@/db/schema";
import { isNull } from "drizzle-orm";
import { getBountyDetails, getPublicClient, POIDH_CONTRACTS, POIDH_ABI } from "@/features/bot/poidh-contract";
import { formatEther } from "viem";

export async function GET(): Promise<NextResponse> {
  // All bounties for full picture
  const all = await db
    .select({
      bountyId: activeBounties.bountyId,
      name: activeBounties.name,
      status: activeBounties.status,
      chain: activeBounties.chain,
      amountEth: activeBounties.amountEth,
      creatorFid: activeBounties.creatorFid,
      winnerClaimId: activeBounties.winnerClaimId,
      createdAt: activeBounties.createdAt,
    })
    .from(activeBounties);

  // Bounties missing creatorFid that are still open/evaluating — need manual cancel
  const needsManualCancel = all.filter(
    (b) => b.creatorFid === null && b.status !== "closed",
  );

  // On-chain verification for bounty #88 specifically
  let onChain88: Record<string, unknown> | null = null;
  try {
    const chain = "arbitrum";
    const publicClient = getPublicClient(chain);
    const contractAddress = POIDH_CONTRACTS[chain];
    const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

    // Read amountEth from DB — don't hardcode it
    const bounty88db = all.find((b) => b.bountyId === "88");
    const dbAmountEth = bounty88db?.amountEth ?? "unknown";

    const details = await getBountyDetails(BigInt(88), chain);
    const onChainAmountEth = formatEther(details.amount);
    const isClaimed = details.claimer !== ZERO_ADDR;
    const wasCancelled = isClaimed && details.claimer.toLowerCase() === details.issuer.toLowerCase();

    // Fetch vote tracker
    let voteTracker: { yesVotes: string; noVotes: string; deadline: string; deadlineHuman: string; hoursLeft: number } | null = null;
    try {
      const tracker = await publicClient.readContract({
        address: contractAddress,
        abi: POIDH_ABI,
        functionName: "bountyVotingTracker",
        args: [BigInt(88)],
      }) as [bigint, bigint, bigint];
      const [yes, no, deadline] = tracker;
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const hoursLeft = deadline > nowSec ? Number((deadline - nowSec) / BigInt(3600)) : 0;
      voteTracker = {
        yesVotes: yes.toString(),
        noVotes: no.toString(),
        deadline: deadline.toString(),
        deadlineHuman: deadline > 0n ? new Date(Number(deadline) * 1000).toISOString() : "none",
        hoursLeft,
      };
    } catch { /* no vote active */ }

    // Fetch pendingWithdrawals for bot wallet
    const botWallet = process.env.BOT_WALLET_ADDRESS ?? "";
    let pendingWithdrawals = "unknown";
    if (botWallet) {
      try {
        const pending = await publicClient.readContract({
          address: contractAddress,
          abi: POIDH_ABI,
          functionName: "pendingWithdrawals",
          args: [botWallet as `0x${string}`],
        }) as bigint;
        pendingWithdrawals = formatEther(pending) + " ETH";
      } catch { /* non-critical */ }
    }

    // The DB amountEth is what the creator deposited (bot's issuer share only)
    // The on-chain amount includes all contributors — we don't use that for creator refund
    const issuerShareMatch = onChainAmountEth === dbAmountEth;

    onChain88 = {
      bountyId: details.id.toString(),
      issuer: details.issuer,
      // on-chain amount = total pot (creator + all contributors)
      onChainTotalPotEth: onChainAmountEth,
      // DB amount = what we stored at creation time (may be wrong for old bounties)
      dbCreatorAmountEth: dbAmountEth,
      // if they match → no external contributors, DB is trustworthy
      // if they differ → external contributions exist OR DB was wrong at creation
      issuerShareMatch,
      note: issuerShareMatch
        ? "DB matches on-chain — no external contributions. DB amountEth is reliable for refund."
        : `MISMATCH: on-chain total is ${onChainAmountEth} ETH vs DB ${dbAmountEth} ETH. ` +
          `Either external contributors added funds, or the DB amount was recorded incorrectly. ` +
          `For manual cancel: use the delta (pendingAfter - pendingBefore) as the refund amount — NOT the DB value.`,
      claimer: details.claimer,
      isClaimed,
      wasCancelled,
      createdAt: new Date(Number(details.createdAt) * 1000).toISOString(),
      winnerClaimId: details.claimId.toString(),
      voteTracker,
      // current pendingWithdrawals balance in bot wallet BEFORE any cancel
      pendingWithdrawalsNow: pendingWithdrawals,
      refundStrategy: issuerShareMatch
        ? `use DB amount: ${dbAmountEth} ETH — matches on-chain issuer share exactly`
        : `use delta (pendingAfter - pendingBefore) after cancelOpenBounty — DB amount unreliable due to mismatch`,
    };
  } catch (err) {
    onChain88 = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json({
    total: all.length,
    nullCreatorFidCount: all.filter((b) => b.creatorFid === null).length,
    needsManualCancel,
    bounty88_onChain: onChain88,
    allBounties: all,
  });
}
