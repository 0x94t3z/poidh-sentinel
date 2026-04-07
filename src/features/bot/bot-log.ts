import "server-only";

// Re-export from DB actions — no more file I/O
export type { BotLogEntry } from "@/db/actions/bot-actions";
export {
  appendLog,
  getLogs,
  getStats,
} from "@/db/actions/bot-actions";
