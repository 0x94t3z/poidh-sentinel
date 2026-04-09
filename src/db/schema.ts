import { pgTable, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Key-Value Store Table
 *
 * Built-in table for simple key-value storage.
 * Available immediately without schema changes.
 *
 * ⚠️ CRITICAL: DO NOT DELETE OR EDIT THIS TABLE DEFINITION ⚠️
 * This table is required for the app to function properly.
 * DO NOT delete, modify, rename, or change any part of this table.
 * Removing or editing it will cause database schema conflicts and prevent
 * the app from starting.
 *
 * Use for:
 * - User preferences/settings
 * - App configuration
 * - Simple counters
 * - Temporary data
 */
export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/**
 * Add your custom tables below this line
 */

// Conversation state — one row per active thread
export const conversationState = pgTable("conversation_state", {
  threadHash: text("thread_hash").primaryKey(),
  step: text("step").notNull(),
  authorFid: integer("author_fid").notNull(),
  authorUsername: text("author_username").notNull(),
  suggestedIdea: jsonb("suggested_idea"),      // { name, description }
  chain: text("chain"),                         // arbitrum | base | degen
  amountEth: text("amount_eth"),
  uniqueAmount: text("unique_amount"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pending payments — threads waiting for a deposit before bounty creation
export const pendingPayments = pgTable("pending_payments", {
  threadHash: text("thread_hash").primaryKey(),
  castHash: text("cast_hash").notNull(),
  state: jsonb("state").notNull(),             // full ConversationState snapshot
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Active bounties created by the bot
export const activeBounties = pgTable("active_bounties", {
  bountyId: text("bounty_id").primaryKey(),
  txHash: text("tx_hash").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  amountEth: text("amount_eth").notNull(),
  chain: text("chain").notNull(),
  castHash: text("cast_hash").notNull(),
  creatorFid: integer("creator_fid"),              // FID of the user who funded this bounty
  announcementCastHash: text("announcement_cast_hash"), // hash of the channel announcement cast
  status: text("status").notNull().default("open"), // open | evaluating | closed
  winnerClaimId: text("winner_claim_id"),
  winnerTxHash: text("winner_tx_hash"),
  winnerReasoning: text("winner_reasoning"),
  allEvalResults: jsonb("all_eval_results"), // EvaluationResult[] — full ranked list from last evaluation
  lastCheckedAt: timestamp("last_checked_at"),
  claimCount: integer("claim_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bounty threads — maps announcement cast hashes to bounty IDs
// Allows the bot to respond to replies in bounty announcement threads
export const bountyThreads = pgTable("bounty_threads", {
  castHash: text("cast_hash").primaryKey(), // announcement cast hash (thread root)
  bountyId: text("bounty_id").notNull(),
  bountyName: text("bounty_name").notNull(),
  bountyDescription: text("bounty_description").notNull(),
  chain: text("chain").notNull(),
  poidhUrl: text("poidh_url"),
  // Winner context — populated when the bot picks a winner
  winnerClaimId: text("winner_claim_id"),
  winnerIssuer: text("winner_issuer"),   // wallet address of the winner
  winnerReasoning: text("winner_reasoning"), // one-sentence explanation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bot activity log
export const botLog = pgTable("bot_log", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  triggerCastHash: text("trigger_cast_hash").notNull(),
  triggerAuthor: text("trigger_author").notNull(),
  triggerText: text("trigger_text").notNull(),
  action: text("action").notNull(),
  replyText: text("reply_text").notNull(),
  status: text("status").notNull(),            // success | error
  errorMessage: text("error_message"),
  txHash: text("tx_hash"),
}, (t) => ({
  botLogTimestampIdx: index("bot_log_timestamp_idx").on(t.timestamp),
}));

// Processed webhook casts — prevents duplicate replies across serverless instances
// Row inserted atomically on first receipt; duplicate deliveries fail the insert and are skipped
export const processedCasts = pgTable("processed_casts", {
  castHash: text("cast_hash").primaryKey(),
  processedAt: timestamp("processed_at").defaultNow().notNull(),
});

// Last known wallet balances for deposit detection
export const walletBalances = pgTable("wallet_balances", {
  balanceKey: text("balance_key").primaryKey(), // e.g. "arbitrum:0x1234..."
  balance: text("balance").notNull(),           // bigint as string
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
