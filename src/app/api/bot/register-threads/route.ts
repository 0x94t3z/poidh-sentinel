import { NextRequest, NextResponse } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { activeBounties, bountyThreads } from "@/db/schema";
import { isNull, isNotNull } from "drizzle-orm";
import { registerBountyThread } from "@/db/actions/bot-actions";
import { resolvePoidhUrl } from "@/features/bot/poidh-contract";

// POST /api/bot/register-threads
// Backfills bountyThreads for any active bounties that have announcementCastHash set
// but aren't yet registered. Also accepts a manual override via body.
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Optional: manual single registration
  let body: { castHash?: string; bountyId?: string; bountyName?: string; bountyDescription?: string; chain?: string; poidhUrl?: string } = {};
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
    });
    return NextResponse.json({ ok: true, registered: [body.castHash] });
  }

  // Auto backfill: find bounties with announcementCastHash not yet in bountyThreads
  const bounties = await db
    .select()
    .from(activeBounties)
    .where(isNotNull(activeBounties.announcementCastHash));

  const existing = await db.select().from(bountyThreads);
  const existingHashes = new Set(existing.map((t) => t.castHash));

  const toRegister = bounties.filter(
    (b) => b.announcementCastHash && !existingHashes.has(b.announcementCastHash),
  );

  const registered: string[] = [];
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
    });
    registered.push(b.announcementCastHash);
  }

  return NextResponse.json({ ok: true, registered, skipped: bounties.length - toRegister.length });
}

// GET — list all registered threads
export async function GET(): Promise<NextResponse> {
  const threads = await db.select().from(bountyThreads);
  return NextResponse.json({ threads });
}
