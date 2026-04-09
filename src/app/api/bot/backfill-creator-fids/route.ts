import { NextRequest, NextResponse } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { activeBounties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getBountyDetails } from "@/features/bot/poidh-contract";
import { checkAdminAuth } from "@/lib/admin-auth";

// One-shot backfill: resolve creatorFid for old bounties that were created before
// creatorFid tracking was added. Targets bounties #88, #97, #100 on Arbitrum.
//
// Steps:
//   1. Read issuer address from on-chain for each bounty
//   2. Resolve Farcaster FID via Neynar bulk-by-address API
//   3. Write creatorFid back to DB
//
// Hit POST /api/bot/backfill-creator-fids once — idempotent, safe to re-run.
// Protected by ADMIN_SECRET — pass as Authorization: Bearer <secret>

const TARGET_BOUNTIES = ["88", "97", "100"] as const;

async function resolveFidByAddress(
  addresses: string[],
): Promise<Map<string, number>> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error("NEYNAR_API_KEY not set");

  const url = `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${addresses.join(",")}`;
  const res = await fetch(url, {
    headers: { "x-api-key": apiKey, accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Neynar bulk-by-address failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as Record<
    string,
    Array<{ fid: number; username: string }>
  >;

  const map = new Map<string, number>();
  for (const [addr, users] of Object.entries(data)) {
    if (users && users.length > 0) {
      map.set(addr.toLowerCase(), users[0].fid);
    }
  }
  return map;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;

  const results: Array<{
    bountyId: string;
    issuerAddress: string | null;
    resolvedFid: number | null;
    previousFid: number | null;
    updated: boolean;
    error?: string;
  }> = [];

  // 1. Fetch current DB state + on-chain issuer for each target bounty
  const onChainIssuers = new Map<string, string>(); // bountyId → issuer address

  for (const bountyId of TARGET_BOUNTIES) {
    try {
      const { issuer } = await getBountyDetails(BigInt(bountyId), "arbitrum");
      onChainIssuers.set(bountyId, issuer.toLowerCase());
    } catch (err) {
      results.push({
        bountyId,
        issuerAddress: null,
        resolvedFid: null,
        previousFid: null,
        updated: false,
        error: `on-chain lookup failed: ${String(err)}`,
      });
    }
  }

  if (onChainIssuers.size === 0) {
    return NextResponse.json({ ok: false, results, error: "all on-chain lookups failed" });
  }

  // 2. Resolve FIDs for unique addresses
  const uniqueAddresses = [...new Set(onChainIssuers.values())];
  let fidMap: Map<string, number>;
  try {
    fidMap = await resolveFidByAddress(uniqueAddresses);
  } catch (err) {
    return NextResponse.json({
      ok: false,
      results,
      error: `Neynar lookup failed: ${String(err)}`,
    });
  }

  // 3. Update DB and collect results
  for (const bountyId of TARGET_BOUNTIES) {
    const issuerAddr = onChainIssuers.get(bountyId);
    if (!issuerAddr) continue; // already logged above

    const fid = fidMap.get(issuerAddr) ?? null;

    // Read current value
    const current = await db
      .select({ creatorFid: activeBounties.creatorFid })
      .from(activeBounties)
      .where(eq(activeBounties.bountyId, bountyId))
      .limit(1);

    const previousFid = current[0]?.creatorFid ?? null;

    if (fid !== null) {
      await db
        .update(activeBounties)
        .set({ creatorFid: fid })
        .where(eq(activeBounties.bountyId, bountyId));
    }

    results.push({
      bountyId,
      issuerAddress: issuerAddr,
      resolvedFid: fid,
      previousFid,
      updated: fid !== null,
    });
  }

  const allUpdated = results.filter((r) => r.updated).length;
  return NextResponse.json({
    ok: true,
    summary: `updated ${allUpdated} / ${TARGET_BOUNTIES.length} bounties`,
    fidMap: Object.fromEntries(fidMap),
    results,
  });
}
