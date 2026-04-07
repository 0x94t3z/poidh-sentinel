import { NextResponse } from "next/server";
import { getLogs, getStats } from "@/features/bot/bot-log";

export async function GET(): Promise<NextResponse> {
  const [logs, stats] = await Promise.all([getLogs(), getStats()]);
  return NextResponse.json({ logs, stats });
}
