import { NextResponse } from "next/server";
import { getAllAwaitingPayment } from "@/db/actions/bot-actions";
import { getActiveBounties } from "@/features/bot/bounty-store";
import { getLogs } from "@/features/bot/bot-log";

export async function GET(): Promise<NextResponse> {
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
