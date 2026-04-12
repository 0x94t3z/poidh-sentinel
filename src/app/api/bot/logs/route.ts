import { NextRequest, NextResponse } from "next/server";
import { getLogs, getLogCount, getStats } from "@/features/bot/bot-log";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);
  const statsOnly = searchParams.get("statsOnly") === "1";

  if (statsOnly) {
    const stats = await getStats();
    return NextResponse.json({ stats });
  }

  const total = await getLogCount();

  let limit: number;
  if (limitParam === "all") {
    limit = Math.max(total - offset, 0);
  } else {
    const parsed = parseInt(limitParam ?? "1000", 10);
    const safeLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : 1000;
    limit = Math.min(safeLimit, 1000);
  }

  const [logs, stats] = await Promise.all([
    getLogs(limit, offset),
    offset === 0 ? getStats() : Promise.resolve(null),
  ]);

  return NextResponse.json({ logs, total, stats });
}
