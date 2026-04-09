import "server-only";

// Re-export from DB actions — no more file I/O
export type { ActiveBounty, EvaluationResult } from "@/db/actions/bot-actions";
export {
  addActiveBounty,
  getActiveBounties,
  getAllBounties,
  updateBounty,
} from "@/db/actions/bot-actions";
