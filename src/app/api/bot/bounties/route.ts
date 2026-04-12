import { NextResponse } from "next/server";
import { getAllBounties } from "@/features/bot/bounty-store";
import { getBountyDetails, getClaimIssuer } from "@/features/bot/poidh-contract";
import { updateBounty } from "@/db/actions/bot-actions";
import { db } from "@/neynar-db-sdk/db";
import { bountyThreads } from "@/db/schema";
import { formatEther } from "viem";

// This endpoint powers live mini-app state; never serve a build-time snapshot.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Batch-resolve ETH addresses → Farcaster usernames via Neynar bulk-by-address.
// Returns a map of lowercase address → username. Missing = no Farcaster account found.
async function resolveAddressesToFarcasterUsernames(addresses: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!addresses.length) return map;
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return map;
  try {
    const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
    const res = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${unique.join(",")}`,
      { headers: { "x-api-key": apiKey } },
    );
    if (!res.ok) return map;
    const data = await res.json() as Record<string, Array<{ username?: string }>>;
    for (const [addr, users] of Object.entries(data)) {
      const username = users?.[0]?.username;
      if (username) map.set(addr.toLowerCase(), username);
    }
  } catch {
    // non-critical — fall back to address display
  }
  return map;
}

export async function GET(): Promise<NextResponse> {
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  const bounties = await getAllBounties();

  // Fallback source for mini app visibility:
  // if a bounty announcement thread exists but active_bounties row is missing,
  // synthesize a read-only bounty card so it still appears in the dashboard.
  const existingByChainAndId = new Set(
    bounties.map((b) => `${b.chain}:${b.bountyId}`),
  );
  const existingThreadHashes = new Set(
    bounties
      .map((b) => b.announcementCastHash ?? b.castHash)
      .filter((h): h is string => !!h),
  );

  const threadRows = await db.select().from(bountyThreads);
  const missingFromActive = threadRows.filter(
    (t) =>
      !existingByChainAndId.has(`${t.chain}:${t.bountyId}`) &&
      !existingThreadHashes.has(t.castHash),
  );

  const synthesizedFromThreads = await Promise.all(
    missingFromActive.map(async (t) => {
      let amountEth = "0";
      let status: "open" | "evaluating" | "closed" = t.winnerClaimId ? "closed" : "open";
      let liveAmountEth: string | null = null;

      if (!t.bountyId.startsWith("pending-")) {
        try {
          const details = await getBountyDetails(BigInt(t.bountyId), t.chain);
          liveAmountEth = parseFloat(formatEther(details.amount))
            .toFixed(6)
            .replace(/\.?0+$/, "");
          amountEth = liveAmountEth || "0";
          if (details.claimer !== ZERO_ADDR) status = "closed";
        } catch {
          // non-critical fallback
        }
      }

      return {
        bountyId: t.bountyId,
        txHash: "",
        name: t.bountyName,
        description: t.bountyDescription,
        amountEth,
        liveAmountEth,
        chain: t.chain,
        castHash: t.castHash,
        creatorFid: undefined,
        announcementCastHash: t.castHash,
        bountyType: "open" as const,
        status,
        winnerClaimId: t.winnerClaimId ?? undefined,
        winnerIssuer: t.winnerIssuer ?? undefined,
        winnerTxHash: undefined,
        winnerReasoning: t.winnerReasoning ?? undefined,
        allEvalResults: undefined,
        lastCheckedAt: undefined,
        claimCount: 0,
        createdAt: t.createdAt.toISOString(),
      };
    }),
  );

  // Step 1: backfill winnerIssuer for old closed bounties that have a winnerClaimId but no address.
  // Fetch from contract in parallel, then persist so we only do this once per bounty.
  const needsBackfill = bounties.filter(
    (b) => b.status === "closed" && b.winnerClaimId && !b.winnerIssuer,
  );

  const backfilledAddresses = await Promise.all(
    needsBackfill.map(async (b) => {
      try {
        const issuer = await getClaimIssuer(BigInt(b.bountyId), BigInt(b.winnerClaimId!), b.chain);
        return { bountyId: b.bountyId, issuer };
      } catch {
        return { bountyId: b.bountyId, issuer: null };
      }
    }),
  );

  // Persist backfilled winnerIssuer addresses
  const backfillMap = new Map<string, string>();
  await Promise.all(
    backfilledAddresses
      .filter((r) => r.issuer !== null)
      .map(async (r) => {
        backfillMap.set(r.bountyId, r.issuer!);
        await updateBounty(r.bountyId, { winnerIssuer: r.issuer! }).catch(() => {});
      }),
  );

  // Backfill stale "bounty cancelled by issuer" → "bounty cancelled by @username" (or "by creator")
  // These were written before we stored authorUsername on cancel. Fix once and persist.
  const staleCancel = bounties.filter((b) => b.winnerReasoning === "bounty cancelled by issuer");
  await Promise.all(
    staleCancel.map(async (b) => {
      let label = "creator";
      if (b.creatorFid) {
        try {
          const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${b.creatorFid}`, {
            headers: { "x-api-key": process.env.NEYNAR_API_KEY ?? "" },
          });
          if (res.ok) {
            const data = await res.json() as { users?: Array<{ username?: string }> };
            const username = data.users?.[0]?.username;
            if (username) label = `@${username}`;
          }
        } catch { /* non-critical */ }
      }
      await updateBounty(b.bountyId, { winnerReasoning: `bounty cancelled by ${label}` }).catch(() => {});
    }),
  );

  // Step 2: enrich with live contract amounts (open bounties) in parallel
  const enriched = await Promise.all(
    bounties.map(async (b) => {
      // Merge backfilled issuer if we just resolved it
      const winnerIssuer = b.winnerIssuer ?? backfillMap.get(b.bountyId) ?? undefined;
      const base = { ...b, winnerIssuer };

      if (b.bountyId.startsWith("pending-") || b.status === "closed") {
        return { ...base, liveAmountEth: null };
      }
      try {
        const details = await getBountyDetails(BigInt(b.bountyId), b.chain);
        const isOnChainClosed = details.claimer !== ZERO_ADDR;
        if (isOnChainClosed) {
          const wasCancelled = details.claimer.toLowerCase() === details.issuer.toLowerCase();
          const nextReasoning = wasCancelled
            ? (base.winnerReasoning ?? "bounty cancelled by issuer")
            : base.winnerReasoning;

          // Auto-heal stale DB rows when on-chain state is already finalized.
          await updateBounty(b.bountyId, {
            status: "closed",
            ...(nextReasoning ? { winnerReasoning: nextReasoning } : {}),
          }).catch(() => {});

          return { ...base, status: "closed" as const, winnerReasoning: nextReasoning, liveAmountEth: null };
        }

        const liveAmountEth = parseFloat(formatEther(details.amount)).toFixed(6).replace(/\.?0+$/, "");
        return { ...base, liveAmountEth };
      } catch {
        return { ...base, liveAmountEth: null };
      }
    }),
  );

  // Step 3: batch-resolve all winner addresses → Farcaster usernames
  const winnerAddresses = [
    ...enriched
    .filter((b) => b.status === "closed" && b.winnerIssuer)
    .map((b) => b.winnerIssuer as string),
    ...synthesizedFromThreads
      .filter((b) => b.status === "closed" && b.winnerIssuer)
      .map((b) => b.winnerIssuer as string),
  ];

  const usernameMap = await resolveAddressesToFarcasterUsernames(winnerAddresses);

  const withUsernames = enriched.map((b) => {
    if (b.status === "closed" && b.winnerIssuer) {
      const username = usernameMap.get(b.winnerIssuer.toLowerCase());
      return { ...b, winnerUsername: username ?? null };
    }
    return { ...b, winnerUsername: null };
  });

  const synthesizedWithUsernames = synthesizedFromThreads.map((b) => {
    if (b.status === "closed" && b.winnerIssuer) {
      const username = usernameMap.get(b.winnerIssuer.toLowerCase());
      return { ...b, winnerUsername: username ?? null };
    }
    return { ...b, winnerUsername: null };
  });

  const merged = [...withUsernames, ...synthesizedWithUsernames].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json(
    { bounties: merged },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
