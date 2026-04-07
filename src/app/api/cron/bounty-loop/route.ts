import { NextRequest, NextResponse } from "next/server";
import { runBountyLoop } from "@/features/bot/bounty-loop";
import { checkDepositsAndCreateBounties } from "@/features/bot/deposit-checker";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Run both in parallel — check deposits + evaluate existing bounties
    const [loopResult] = await Promise.allSettled([
      runBountyLoop(),
      checkDepositsAndCreateBounties(),
    ]);

    const result = loopResult.status === "fulfilled" ? loopResult.value : { processed: 0, winners: 0, errors: 1 };
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
