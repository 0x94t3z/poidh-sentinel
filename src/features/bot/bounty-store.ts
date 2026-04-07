import "server-only";

// Re-export from DB actions — no more file I/O
export type { ActiveBounty } from "@/db/actions/bot-actions";
export {
  addActiveBounty,
  getActiveBounties,
  getAllBounties,
  updateBounty,
} from "@/db/actions/bot-actions";

// getBountyById — not in the shared actions yet, add inline
import { db } from "@/neynar-db-sdk/db";
import { activeBounties } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ActiveBounty, EvaluationResult } from "@/db/actions/bot-actions";
export type { EvaluationResult };

export async function getBountyById(bountyId: string): Promise<ActiveBounty | undefined> {
  const rows = await db
    .select()
    .from(activeBounties)
    .where(eq(activeBounties.bountyId, bountyId))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return {
    bountyId: row.bountyId,
    txHash: row.txHash,
    name: row.name,
    description: row.description,
    amountEth: row.amountEth,
    chain: row.chain,
    castHash: row.castHash,
    status: row.status as "open" | "evaluating" | "closed",
    winnerClaimId: row.winnerClaimId ?? undefined,
    winnerTxHash: row.winnerTxHash ?? undefined,
    winnerReasoning: row.winnerReasoning ?? undefined,
    allEvalResults: row.allEvalResults as EvaluationResult[] | undefined ?? undefined,
    lastCheckedAt: row.lastCheckedAt?.toISOString(),
    claimCount: row.claimCount,
    createdAt: row.createdAt.toISOString(),
  };
}
