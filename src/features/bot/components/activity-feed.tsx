"use client";

import { useState, useCallback } from "react";
import type { BotLogEntry } from "@/features/bot/types";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  suggest_bounty: { label: "SUGGEST", color: "text-blue-400" },
  evaluate_submission: { label: "EVALUATE", color: "text-amber-400" },
  pick_winner: { label: "WINNER", color: "text-green-400" },
  create_bounty: { label: "CREATE", color: "text-purple-400" },
  create_bounty_onchain: { label: "ONCHAIN", color: "text-indigo-400" },
  wallet_address: { label: "WALLET", color: "text-teal-400" },
  deposit_detected: { label: "DEPOSIT", color: "text-green-300" },
  general_reply: { label: "REPLY", color: "text-gray-400" },
};
const FALLBACK_ACTION = { label: "EVENT", color: "text-gray-500" };
const PAGE_SIZE = 20;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function LogRow({ entry }: { entry: BotLogEntry }) {
  const actionMeta = ACTION_LABELS[entry.action] ?? FALLBACK_ACTION;
  const isError = entry.status === "error";
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`border-b border-white/5 px-4 py-3 last:border-0 ${isError ? "bg-red-500/5" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold ${isError ? "text-red-400" : actionMeta.color}`}>
            {isError ? "ERROR" : actionMeta.label}
          </span>
          <span className="text-gray-500 font-mono text-[10px]">@{entry.triggerAuthor}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono ${isError ? "text-red-500" : "text-green-500"}`}>
            {isError ? "✗" : "✓"}
          </span>
          <span className="text-gray-600 font-mono text-[10px]">{time}</span>
        </div>
      </div>

      {/* Trigger */}
      <p className="text-gray-400 text-xs font-mono leading-relaxed">
        {truncate(entry.triggerText, 80)}
      </p>

      {/* Reply */}
      {entry.replyText && (
        <p className="text-gray-300 text-xs font-mono leading-relaxed mt-1 pl-2 border-l border-green-500/30">
          {truncate(entry.replyText, 100)}
        </p>
      )}

      {/* Error message */}
      {entry.errorMessage && (
        <p className="text-red-400 text-[10px] font-mono mt-1.5 pl-2 border-l border-red-500/40 leading-relaxed">
          {entry.errorMessage}
        </p>
      )}
    </div>
  );
}

interface ActivityFeedProps {
  logs: BotLogEntry[];
  total: number;
  totalErrors: number; // from stats — accurate across full history, not just loaded slice
  botUsername: string;
}

export function ActivityFeed({ logs: initialLogs, total, totalErrors, botUsername }: ActivityFeedProps) {
  const [filter, setFilter] = useState<"all" | "errors">("all");
  const [logs, setLogs] = useState<BotLogEntry[]>(initialLogs);
  const [loadedTotal, setLoadedTotal] = useState(total);
  const [loading, setLoading] = useState(false);

  const hasMore = logs.length < loadedTotal;
  // Count errors only in loaded logs — used to decide whether errors filter has visible results
  const loadedErrorCount = logs.filter((l) => l.status === "error").length;
  const filtered = filter === "errors" ? logs.filter((l) => l.status === "error") : logs;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bot/logs?limit=${PAGE_SIZE}&offset=${logs.length}`);
      const data = await res.json() as { logs: BotLogEntry[]; total: number };
      setLogs((prev) => [...prev, ...data.logs]);
      setLoadedTotal(data.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, logs.length]);

  // When user clicks errors filter and no errors are in the loaded slice yet,
  // keep loading pages until we surface some (or exhaust all logs)
  const loadUntilErrors = useCallback(async () => {
    if (loadedErrorCount > 0 || loading) return;
    setLoading(true);
    let currentLogs = logs;
    let currentTotal = loadedTotal;
    try {
      while (currentLogs.filter((l) => l.status === "error").length === 0 && currentLogs.length < currentTotal) {
        const res = await fetch(`/api/bot/logs?limit=${PAGE_SIZE}&offset=${currentLogs.length}`);
        const data = await res.json() as { logs: BotLogEntry[]; total: number };
        currentLogs = [...currentLogs, ...data.logs];
        currentTotal = data.total;
      }
      setLogs(currentLogs);
      setLoadedTotal(currentTotal);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loadedErrorCount, loading, logs, loadedTotal]);

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">👻</span>
        <p className="text-gray-500 font-mono text-sm">no activity yet</p>
        <p className="text-gray-600 font-mono text-xs mt-1">
          mention @{botUsername} in a cast to trigger the bot
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors ${
              filter === "all" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            all ({loadedTotal})
          </button>
          <button
            onClick={() => { setFilter("errors"); void loadUntilErrors(); }}
            className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              filter === "errors"
                ? "bg-red-500/20 text-red-400"
                : totalErrors > 0
                ? "text-red-500 hover:text-red-400"
                : "text-gray-600 cursor-default"
            }`}
            disabled={totalErrors === 0}
          >
            errors
            {totalErrors > 0 && (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${filter === "errors" ? "bg-red-500/30" : "bg-red-500/20"}`}>
                {totalErrors}
              </span>
            )}
            {totalErrors === 0 && " (0)"}
          </button>
        </div>
        {hasMore && filter === "all" && (
          <span className="text-[10px] text-gray-600 font-mono">
            {logs.length}/{loadedTotal}
          </span>
        )}
      </div>

      {/* Empty state for errors filter — loading state while fetching */}
      {filter === "errors" && loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-gray-500 font-mono text-xs">fetching errors…</p>
        </div>
      )}

      {/* Empty state for errors filter — genuinely none */}
      {filtered.length === 0 && filter === "errors" && !loading && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-green-500 font-mono text-sm">✓ no errors</p>
          <p className="text-gray-600 font-mono text-[10px] mt-1">all systems nominal</p>
        </div>
      )}

      {filtered.map((entry) => (
        <LogRow key={entry.id} entry={entry} />
      ))}

      {/* Load more */}
      {hasMore && filter === "all" && (
        <div className="px-4 py-3 border-t border-white/5">
          <button
            onClick={() => void loadMore()}
            disabled={loading}
            className="w-full text-[11px] font-mono text-gray-500 hover:text-green-400 disabled:text-gray-700 transition-colors py-1"
          >
            {loading ? "loading…" : `load more (${loadedTotal - logs.length} remaining)`}
          </button>
        </div>
      )}
    </div>
  );
}
