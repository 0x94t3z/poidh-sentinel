import { NextResponse } from "next/server";
import { getAllBounties } from "@/features/bot/bounty-store";
import { getBountyDetails, getClaimIssuer } from "@/features/bot/poidh-contract";
import { updateBounty } from "@/db/actions/bot-actions";
import { formatEther } from "viem";

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
  const bounties = await getAllBounties();

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
        const liveAmountEth = parseFloat(formatEther(details.amount)).toFixed(6).replace(/\.?0+$/, "");
        return { ...base, liveAmountEth };
      } catch {
        return { ...base, liveAmountEth: null };
      }
    }),
  );

  // Step 3: batch-resolve all winner addresses → Farcaster usernames
  const winnerAddresses = enriched
    .filter((b) => b.status === "closed" && b.winnerIssuer)
    .map((b) => b.winnerIssuer as string);

  const usernameMap = await resolveAddressesToFarcasterUsernames(winnerAddresses);

  const withUsernames = enriched.map((b) => {
    if (b.status === "closed" && b.winnerIssuer) {
      const username = usernameMap.get(b.winnerIssuer.toLowerCase());
      return { ...b, winnerUsername: username ?? null };
    }
    return { ...b, winnerUsername: null };
  });

  return NextResponse.json({ bounties: withUsernames });
}
