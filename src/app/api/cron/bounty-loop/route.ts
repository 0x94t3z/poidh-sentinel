import { NextRequest, NextResponse } from "next/server";
import { runBountyLoop } from "@/features/bot/bounty-loop";
import { checkDepositsAndCreateBounties } from "@/features/bot/deposit-checker";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "Server misconfigured: CRON_SECRET is required in production" },
        { status: 500 },
      );
    }
    console.warn("[cron] CRON_SECRET missing in non-production — endpoint is unsecured for local/dev use");
  } else {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Run both in parallel — check deposits + evaluate existing bounties
    const [loopResult, depositResult] = await Promise.allSettled([
      runBountyLoop(),
      checkDepositsAndCreateBounties(),
    ]);

    const loop = loopResult.status === "fulfilled"
      ? loopResult.value
      : { processed: 0, winners: 0, errors: 1 };
    const depositOk = depositResult.status === "fulfilled";

    if (loopResult.status === "rejected") {
      const reason = loopResult.reason instanceof Error ? loopResult.reason.message : String(loopResult.reason);
      console.error("[cron] runBountyLoop failed:", reason);
    }
    if (depositResult.status === "rejected") {
      const reason = depositResult.reason instanceof Error ? depositResult.reason.message : String(depositResult.reason);
      console.error("[cron] checkDepositsAndCreateBounties failed:", reason);
    }

    const ok = loopResult.status === "fulfilled" && depositOk;
    const payload = {
      ok,
      ...loop,
      depositCheckerOk: depositOk,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(payload, { status: ok ? 200 : 500 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
