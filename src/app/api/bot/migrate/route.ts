import { NextRequest, NextResponse } from "next/server";
import { db } from "@/neynar-db-sdk/db";
import { sql } from "drizzle-orm";

// One-shot migration endpoint — adds new columns to existing tables.
// Safe to call multiple times (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
// Protect with CRON_SECRET so it can't be called by random users.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, string> = {};

  // Add winner context columns to bounty_threads
  const migrations = [
    {
      name: "bounty_threads.winner_claim_id",
      query: `ALTER TABLE bounty_threads ADD COLUMN IF NOT EXISTS winner_claim_id text`,
    },
    {
      name: "bounty_threads.winner_issuer",
      query: `ALTER TABLE bounty_threads ADD COLUMN IF NOT EXISTS winner_issuer text`,
    },
    {
      name: "bounty_threads.winner_reasoning",
      query: `ALTER TABLE bounty_threads ADD COLUMN IF NOT EXISTS winner_reasoning text`,
    },
    {
      name: "active_bounties.all_eval_results",
      query: `ALTER TABLE active_bounties ADD COLUMN IF NOT EXISTS all_eval_results jsonb`,
    },
  ];

  for (const m of migrations) {
    try {
      await db.execute(sql.raw(m.query));
      results[m.name] = "ok";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results[m.name] = `error: ${msg}`;
    }
  }

  return NextResponse.json({ ok: true, results });
}
