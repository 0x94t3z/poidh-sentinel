import "server-only";

import { db } from "@/neynar-db-sdk/db";
import {
  conversationState,
  pendingPayments,
  activeBounties,
  bountyThreads,
  botLog,
  walletBalances,
  processedCasts,
} from "@/db/schema";
import { eq, desc, lt, count } from "drizzle-orm";

// ─── Conversation State ───────────────────────────────────────────────────────

export type ConversationStep =
  | "awaiting_confirmation"
  | "awaiting_chain"
  | "awaiting_bounty_type"
  | "awaiting_payment"
  | "creating_bounty"
  | "awaiting_cancel_confirmation"
  | "done";

export interface ConversationState {
  step: ConversationStep;
  authorFid: number;
  authorUsername: string;
  suggestedIdea?: { name: string; description: string };
  chain?: "arbitrum" | "base" | "degen";
  amountEth?: string;
  uniqueAmount?: string;
  bountyType?: "open" | "solo"; // default: "open"
  // Cancel flow
  cancelBountyId?: string;
  cancelBountyChain?: string;
  cancelBountyName?: string;
  cancelRefundAddress?: string; // pre-resolved creator wallet, shown in confirmation
  lastUpdated: string;
}

export async function getConversation(threadHash: string): Promise<ConversationState | undefined> {
  const TTL_MS = 2 * 60 * 60 * 1000;
  const rows = await db
    .select()
    .from(conversationState)
    .where(eq(conversationState.threadHash, threadHash))
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;

  // Expire stale conversations
  if (Date.now() - row.updatedAt.getTime() > TTL_MS) {
    await db.delete(conversationState).where(eq(conversationState.threadHash, threadHash));
    return undefined;
  }

  // Decode suggestedIdea JSONB — may contain cancel-flow fields instead of bounty idea
  const raw = row.suggestedIdea as Record<string, string> | null;
  const isCancelData = raw && "cancelBountyId" in raw;

  return {
    step: row.step as ConversationStep,
    authorFid: row.authorFid,
    authorUsername: row.authorUsername,
    suggestedIdea: isCancelData ? undefined : (raw as { name: string; description: string } | undefined),
    cancelBountyId: isCancelData ? raw.cancelBountyId : undefined,
    cancelBountyChain: isCancelData ? raw.cancelBountyChain : undefined,
    cancelBountyName: isCancelData ? raw.cancelBountyName : undefined,
    cancelRefundAddress: isCancelData ? raw.cancelRefundAddress : undefined,
    chain: row.chain as "arbitrum" | "base" | "degen" | undefined,
    amountEth: row.amountEth ?? undefined,
    uniqueAmount: row.uniqueAmount ?? undefined,
    lastUpdated: row.updatedAt.toISOString(),
  };
}

export async function setConversation(threadHash: string, state: ConversationState): Promise<void> {
  // Pack cancel-flow fields into suggestedIdea JSONB when present (cancel step doesn't use suggestedIdea)
  const cancelData = state.cancelBountyId
    ? {
        cancelBountyId: state.cancelBountyId,
        cancelBountyChain: state.cancelBountyChain,
        cancelBountyName: state.cancelBountyName,
        cancelRefundAddress: state.cancelRefundAddress,
      }
    : null;
  const ideaPayload = cancelData ?? state.suggestedIdea ?? null;

  await db
    .insert(conversationState)
    .values({
      threadHash,
      step: state.step,
      authorFid: state.authorFid,
      authorUsername: state.authorUsername,
      suggestedIdea: ideaPayload,
      chain: state.chain ?? null,
      amountEth: state.amountEth ?? null,
      uniqueAmount: state.uniqueAmount ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: conversationState.threadHash,
      set: {
        step: state.step,
        authorFid: state.authorFid,
        authorUsername: state.authorUsername,
        suggestedIdea: ideaPayload,
        chain: state.chain ?? null,
        amountEth: state.amountEth ?? null,
        uniqueAmount: state.uniqueAmount ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function clearConversation(threadHash: string): Promise<void> {
  await db.delete(conversationState).where(eq(conversationState.threadHash, threadHash));
}

// ─── Pending Payments ─────────────────────────────────────────────────────────

export interface PendingPayment {
  threadHash: string;
  castHash: string;
  state: ConversationState;
}

export async function registerPendingPayment(
  threadHash: string,
  castHash: string,
  state: ConversationState,
): Promise<void> {
  await db
    .insert(pendingPayments)
    .values({ threadHash, castHash, state })
    .onConflictDoUpdate({
      target: pendingPayments.threadHash,
      set: { castHash, state, createdAt: new Date() },
    });
}

export async function unregisterPendingPayment(threadHash: string): Promise<void> {
  await db.delete(pendingPayments).where(eq(pendingPayments.threadHash, threadHash));
}

export async function getAllAwaitingPayment(): Promise<PendingPayment[]> {
  const rows = await db.select().from(pendingPayments);
  return rows.map((r) => ({
    threadHash: r.threadHash,
    castHash: r.castHash,
    state: r.state as ConversationState,
  }));
}

// ─── Active Bounties ──────────────────────────────────────────────────────────

export interface EvaluationResult {
  claimId: string;
  score: number;
  valid: boolean;
  reasoning: string;
  deterministicScore?: number;
}

export interface ActiveBounty {
  bountyId: string;
  txHash: string;
  name: string;
  description: string;
  amountEth: string;
  chain: string;
  castHash: string;
  creatorFid?: number;
  announcementCastHash?: string;
  bountyType: "open" | "solo"; // open = community vote; solo = creator picks winner on poidh.xyz
  status: "open" | "evaluating" | "closed";
  winnerClaimId?: string;
  winnerIssuer?: string;
  winnerTxHash?: string;
  winnerReasoning?: string;
  allEvalResults?: EvaluationResult[];
  lastCheckedAt?: string;
  claimCount: number;
  createdAt: string;
}

export async function addActiveBounty(bounty: ActiveBounty): Promise<void> {
  await db
    .insert(activeBounties)
    .values({
      bountyId: bounty.bountyId,
      txHash: bounty.txHash,
      name: bounty.name,
      description: bounty.description,
      amountEth: bounty.amountEth,
      chain: bounty.chain,
      castHash: bounty.castHash,
      creatorFid: bounty.creatorFid ?? null,
      announcementCastHash: bounty.announcementCastHash ?? null,
      bountyType: bounty.bountyType ?? "open",
      status: bounty.status,
      winnerClaimId: bounty.winnerClaimId ?? null,
      winnerTxHash: bounty.winnerTxHash ?? null,
      winnerReasoning: bounty.winnerReasoning ?? null,
      allEvalResults: bounty.allEvalResults ?? null,
      claimCount: bounty.claimCount,
    })
    .onConflictDoNothing();
}

// ─── Bounty Threads ───────────────────────────────────────────────────────────

export interface BountyThread {
  castHash: string;
  bountyId: string;
  bountyName: string;
  bountyDescription: string;
  chain: string;
  poidhUrl?: string;
  winnerClaimId?: string;
  winnerIssuer?: string;
  winnerReasoning?: string;
}

export async function registerBountyThread(thread: BountyThread): Promise<void> {
  await db
    .insert(bountyThreads)
    .values({
      castHash: thread.castHash,
      bountyId: thread.bountyId,
      bountyName: thread.bountyName,
      bountyDescription: thread.bountyDescription,
      chain: thread.chain,
      poidhUrl: thread.poidhUrl ?? null,
      winnerClaimId: thread.winnerClaimId ?? null,
      winnerIssuer: thread.winnerIssuer ?? null,
      winnerReasoning: thread.winnerReasoning ?? null,
    })
    .onConflictDoUpdate({
      target: bountyThreads.castHash,
      set: {
        winnerClaimId: thread.winnerClaimId ?? null,
        winnerIssuer: thread.winnerIssuer ?? null,
        winnerReasoning: thread.winnerReasoning ?? null,
      },
    });
}

export async function getBountyThread(castHash: string): Promise<BountyThread | undefined> {
  const rows = await db
    .select()
    .from(bountyThreads)
    .where(eq(bountyThreads.castHash, castHash))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return {
    castHash: row.castHash,
    bountyId: row.bountyId,
    bountyName: row.bountyName,
    bountyDescription: row.bountyDescription,
    chain: row.chain,
    poidhUrl: row.poidhUrl ?? undefined,
    winnerClaimId: row.winnerClaimId ?? undefined,
    winnerIssuer: row.winnerIssuer ?? undefined,
    winnerReasoning: row.winnerReasoning ?? undefined,
  };
}

export async function getActiveBounties(): Promise<ActiveBounty[]> {
  const rows = await db
    .select()
    .from(activeBounties)
    .where(eq(activeBounties.status, "open"))
    .orderBy(desc(activeBounties.createdAt));
  return rows.map(rowToBounty);
}

export async function getAllBounties(): Promise<ActiveBounty[]> {
  const rows = await db
    .select()
    .from(activeBounties)
    .orderBy(desc(activeBounties.createdAt));
  return rows.map(rowToBounty);
}

export async function updateBounty(bountyId: string, updates: Partial<ActiveBounty> & { newBountyId?: string }): Promise<void> {
  await db
    .update(activeBounties)
    .set({
      ...(updates.newBountyId !== undefined && { bountyId: updates.newBountyId }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.winnerClaimId !== undefined && { winnerClaimId: updates.winnerClaimId }),
      ...(updates.winnerIssuer !== undefined && { winnerIssuer: updates.winnerIssuer }),
      ...(updates.winnerTxHash !== undefined && { winnerTxHash: updates.winnerTxHash }),
      ...(updates.winnerReasoning !== undefined && { winnerReasoning: updates.winnerReasoning }),
      ...(updates.allEvalResults !== undefined && { allEvalResults: updates.allEvalResults }),
      ...(updates.claimCount !== undefined && { claimCount: updates.claimCount }),
      ...(updates.lastCheckedAt !== undefined && { lastCheckedAt: new Date(updates.lastCheckedAt) }),
      ...(updates.announcementCastHash !== undefined && { announcementCastHash: updates.announcementCastHash }),
    })
    .where(eq(activeBounties.bountyId, bountyId));
}

export async function getActiveBounty(bountyId: string): Promise<ActiveBounty | undefined> {
  const rows = await db
    .select()
    .from(activeBounties)
    .where(eq(activeBounties.bountyId, bountyId))
    .limit(1);
  return rows[0] ? rowToBounty(rows[0]) : undefined;
}

function rowToBounty(row: typeof activeBounties.$inferSelect): ActiveBounty {
  return {
    bountyId: row.bountyId,
    txHash: row.txHash,
    name: row.name,
    description: row.description,
    amountEth: row.amountEth,
    chain: row.chain,
    castHash: row.castHash,
    creatorFid: row.creatorFid ?? undefined,
    announcementCastHash: row.announcementCastHash ?? undefined,
    bountyType: (row.bountyType ?? "open") as "open" | "solo",
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

// ─── Bot Log ──────────────────────────────────────────────────────────────────

export interface BotLogEntry {
  id: string;
  timestamp: string;
  triggerCastHash: string;
  triggerAuthor: string;
  triggerText: string;
  action: string;
  replyText: string;
  status: "success" | "error";
  errorMessage?: string;
  txHash?: string;
}

export async function appendLog(entry: BotLogEntry): Promise<void> {
  try {
    await db.insert(botLog).values({
      id: entry.id,
      timestamp: new Date(entry.timestamp),
      triggerCastHash: entry.triggerCastHash,
      triggerAuthor: entry.triggerAuthor,
      triggerText: entry.triggerText,
      action: entry.action,
      replyText: entry.replyText,
      status: entry.status,
      errorMessage: entry.errorMessage ?? null,
      txHash: entry.txHash ?? null,
    }).onConflictDoNothing();
  } catch (err) {
    console.error("[bot-actions] appendLog failed:", err);
  }
}

export async function getLogs(limit = 30, offset = 0): Promise<BotLogEntry[]> {
  const rows = await db
    .select()
    .from(botLog)
    .orderBy(desc(botLog.timestamp))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp.toISOString(),
    triggerCastHash: r.triggerCastHash,
    triggerAuthor: r.triggerAuthor,
    triggerText: r.triggerText,
    action: r.action,
    replyText: r.replyText,
    status: r.status as "success" | "error",
    errorMessage: r.errorMessage ?? undefined,
    txHash: r.txHash ?? undefined,
  }));
}

export async function getLogCount(): Promise<number> {
  const rows = await db.select({ count: count() }).from(botLog);
  return rows[0]?.count ?? 0;
}

export async function getStats() {
  // Stats use a wider window (last 500) so counts are meaningful
  const rows = await getLogs(500, 0);
  return {
    total: rows.length,
    success: rows.filter((r) => r.status === "success").length,
    errors: rows.filter((r) => r.status === "error").length,
    lastActivity: rows[0]?.timestamp ?? null,
  };
}

// ─── Deduplication ────────────────────────────────────────────────────────────

// Atomically marks a cast as processed. Returns true if this is the first time
// (safe to process), false if already seen (duplicate — skip).
export async function markCastProcessed(castHash: string): Promise<boolean> {
  try {
    const result = await db
      .insert(processedCasts)
      .values({ castHash })
      .onConflictDoNothing()
      .returning({ castHash: processedCasts.castHash });
    return result.length > 0;
  } catch (err) {
    // Log the error so we can see it in production logs — a silent fail here
    // means the dedup is broken and every serverless instance will process the cast.
    console.error("[dedup] markCastProcessed failed — dedup is OFF:", err);
    // Still allow processing so legitimate events aren't dropped,
    // but this will cause duplicate replies until the schema is fixed.
    return true;
  }
}

// Prune processed casts older than 1 hour to keep the table small
export async function pruneProcessedCasts(): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  await db.delete(processedCasts).where(lt(processedCasts.processedAt, cutoff));
}

// ─── Wallet Balances ──────────────────────────────────────────────────────────

export async function getWalletBalance(key: string): Promise<bigint> {
  const rows = await db
    .select()
    .from(walletBalances)
    .where(eq(walletBalances.balanceKey, key))
    .limit(1);
  return rows[0] ? BigInt(rows[0].balance) : BigInt(0);
}

export async function setWalletBalance(key: string, balance: bigint): Promise<void> {
  await db
    .insert(walletBalances)
    .values({ balanceKey: key, balance: balance.toString(), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: walletBalances.balanceKey,
      set: { balance: balance.toString(), updatedAt: new Date() },
    });
}
