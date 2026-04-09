import { NextRequest, NextResponse } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { activeBounties, bountyThreads } from "@/db/schema";
import { isNotNull } from "drizzle-orm";
import { registerBountyThread } from "@/db/actions/bot-actions";
import { resolvePoidhUrl } from "@/features/bot/poidh-contract";
import { checkAdminAuth } from "@/lib/admin-auth";

// POST /api/bot/register-threads
// Backfills bountyThreads for any bounties (any status) that have announcementCastHash set
// but aren't yet registered. Also accepts a manual override via body.
// For closed bounties, winner data is carried over so the bot can reply contextually.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;

  // Optional: manual single registration
  let body: {
    castHash?: string;
    bountyId?: string;
    bountyName?: string;
    bountyDescription?: string;
    chain?: string;
    poidhUrl?: string;
    winnerClaimId?: string;
    winnerIssuer?: string;
    winnerReasoning?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // no body — do auto backfill
  }

  if (body.castHash && body.bountyId && body.bountyName && body.chain) {
    await registerBountyThread({
      castHash: body.castHash,
      bountyId: body.bountyId,
      bountyName: body.bountyName,
      bountyDescription: body.bountyDescription ?? "",
      chain: body.chain,
      poidhUrl: body.poidhUrl,
      winnerClaimId: body.winnerClaimId,
      winnerIssuer: body.winnerIssuer,
      winnerReasoning: body.winnerReasoning,
    });
    return NextResponse.json({ ok: true, registered: [body.castHash] });
  }

  // Auto backfill: find ALL bounties with announcementCastHash (any status)
  const bounties = await db
    .select()
    .from(activeBounties)
    .where(isNotNull(activeBounties.announcementCastHash));

  const existing = await db.select().from(bountyThreads);
  const existingHashes = new Set(existing.map((t) => t.castHash));

  // For open/evaluating: register if not already present
  // For closed: always upsert so winner data is carried over (onConflictDoUpdate handles this)
  const toRegister = bounties.filter(
    (b) => b.announcementCastHash && (
      !existingHashes.has(b.announcementCastHash) || b.status === "closed"
    ),
  );

  const registered: string[] = [];
  const updated: string[] = [];

  for (const b of toRegister) {
    if (!b.announcementCastHash) continue;

    const poidhUrl = !b.bountyId.startsWith("pending-")
      ? resolvePoidhUrl(b.chain, b.bountyId)
      : undefined;

    await registerBountyThread({
      castHash: b.announcementCastHash,
      bountyId: b.bountyId,
      bountyName: b.name,
      bountyDescription: b.description,
      chain: b.chain,
      poidhUrl,
      // Carry winner context for closed bounties — bot can reply "winner was X" in thread
      winnerClaimId: b.winnerClaimId ?? undefined,
      winnerReasoning: b.winnerReasoning ?? undefined,
    });

    const isNew = !existingHashes.has(b.announcementCastHash);
    if (isNew) {
      registered.push(`${b.bountyId} (${b.status})`);
    } else {
      updated.push(`${b.bountyId} (${b.status}, winner synced)`);
    }
  }

  const skipped = bounties.length - toRegister.length;

  return NextResponse.json({
    ok: true,
    registered,
    updated,
    skipped,
    summary: `${registered.length} new, ${updated.length} updated (winner data synced), ${skipped} already registered`,
  });
}

// GET — list all registered threads
export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;

  const threads = await db.select().from(bountyThreads);
  return NextResponse.json({ threads });
}
