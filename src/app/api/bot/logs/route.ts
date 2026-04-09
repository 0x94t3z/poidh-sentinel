import { NextRequest, NextResponse } from "next/server";
import { getLogs, getStats } from "@/features/bot/bot-log";
import { checkAdminAuth } from "@/lib/admin-auth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;

  const [logs, stats] = await Promise.all([getLogs(), getStats()]);
  return NextResponse.json({ logs, stats });
}
