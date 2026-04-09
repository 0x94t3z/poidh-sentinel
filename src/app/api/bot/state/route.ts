import { NextRequest, NextResponse } from "next/server";
import { getAllAwaitingPayment } from "@/db/actions/bot-actions";
import { getActiveBounties } from "@/features/bot/bounty-store";
import { getLogs } from "@/features/bot/bot-log";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;
  const [pending, bounties, logs] = await Promise.all([
    getAllAwaitingPayment(),
    getActiveBounties(),
    getLogs(),
  ]);

  return NextResponse.json({
    pendingPayments: pending,
    activeBounties: bounties,
    recentLogs: logs.slice(-20),
  });
}
