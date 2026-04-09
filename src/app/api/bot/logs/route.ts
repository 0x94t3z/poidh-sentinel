import { NextRequest, NextResponse } from "next/server";
import { getLogs, getLogCount, getStats } from "@/features/bot/bot-log";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
  const statsOnly = searchParams.get("statsOnly") === "1";

  if (statsOnly) {
    const stats = await getStats();
    return NextResponse.json({ stats });
  }

  const [logs, total, stats] = await Promise.all([
    getLogs(limit, offset),
    getLogCount(),
    offset === 0 ? getStats() : Promise.resolve(null),
  ]);

  return NextResponse.json({ logs, total, stats });
}
