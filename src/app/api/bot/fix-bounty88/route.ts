import { NextRequest, NextResponse } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { activeBounties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkAdminAuth } from "@/lib/admin-auth";

// One-shot fix: correct the amountEth for bounty #88 which was recorded incorrectly
// Creator paid 0.001 ETH — DB incorrectly shows 0.002
// Protected by ADMIN_SECRET — pass as Authorization: Bearer <secret>
export async function POST(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;
  const before = await db
    .select({ bountyId: activeBounties.bountyId, amountEth: activeBounties.amountEth })
    .from(activeBounties)
    .where(eq(activeBounties.bountyId, "88"))
    .limit(1);

  await db
    .update(activeBounties)
    .set({ amountEth: "0.001" })
    .where(eq(activeBounties.bountyId, "88"));

  const after = await db
    .select({ bountyId: activeBounties.bountyId, amountEth: activeBounties.amountEth })
    .from(activeBounties)
    .where(eq(activeBounties.bountyId, "88"))
    .limit(1);

  return NextResponse.json({
    ok: true,
    before: before[0],
    after: after[0],
  });
}
