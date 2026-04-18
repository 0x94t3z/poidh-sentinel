"use client";

import { useState, useEffect } from "react";
import type { BotLogEntry } from "@/features/bot/types";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  suggest_bounty: { label: "SUGGEST", color: "text-blue-400" },
  evaluate_submission: { label: "EVALUATE", color: "text-amber-400" },
  pick_winner: { label: "WINNER", color: "text-green-400" },
  create_bounty: { label: "CREATE", color: "text-purple-400" },
  create_bounty_onchain: { label: "ONCHAIN", color: "text-indigo-400" },
  wallet_address: { label: "WALLET", color: "text-teal-400" },
  deposit_detected: { label: "DEPOSIT", color: "text-green-300" },
  bounty_posted_ui: { label: "BOUNTY", color: "text-indigo-300" },
  winner_evaluation_started: { label: "EVAL", color: "text-violet-300" },
  no_winner_found: { label: "NO WIN", color: "text-amber-300" },
  winner_candidate_selected: { label: "CANDIDATE", color: "text-cyan-300" },
  winner_resolution_started: { label: "RESOLVE", color: "text-green-300" },
  winner_resolution_failed: { label: "RESOLVE", color: "text-red-400" },
  general_reply: { label: "REPLY", color: "text-gray-400" },
};
const FALLBACK_ACTION = { label: "EVENT", color: "text-gray-500" };
const CHAT_ACTIONS = new Set([
  "general_reply",
  "suggest_bounty",
  "evaluate_submission",
  "pick_winner",
  "create_bounty",
  "create_bounty_onchain",
  "wallet_address",
]);

interface FeedBountyItem {
  bountyId: string;
  name: string;
  chain: string;
  amountEth: string;
  createdAt: string;
}

interface FeedItem {
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

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

function LogRow({ entry }: { entry: FeedItem }) {
  const actionMeta = ACTION_LABELS[entry.action] ?? FALLBACK_ACTION;
  const isError = entry.status === "error";
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`border-b border-white/5 px-4 py-3.5 last:border-0 ${isError ? "bg-red-500/8" : "bg-white/[0.01]"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/5 ${isError ? "text-red-400" : actionMeta.color}`}>
            {isError ? "ERROR" : actionMeta.label}
          </span>
          <span className="text-gray-400 font-mono text-[11px]">@{entry.triggerAuthor}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className={`text-[11px] font-mono ${isError ? "text-red-500" : "text-green-500"}`}>
            {isError ? "✗" : "✓"}
          </span>
          <span className="text-gray-500 font-mono text-[11px]">{time}</span>
        </div>
      </div>

      {/* Trigger */}
      <p className="text-gray-200 text-[12px] font-mono leading-relaxed">
        {truncate(entry.triggerText, 120)}
      </p>

      {/* Reply */}
      {entry.replyText && (
        <div className="mt-2 rounded-md bg-black/35 border border-white/5 px-2.5 py-2">
          <p className="text-gray-300 text-[12px] font-mono leading-relaxed border-l border-green-500/30 pl-2">
            {truncate(entry.replyText, 160)}
          </p>
        </div>
      )}

      {/* Error message */}
      {entry.errorMessage && (
        <div className="mt-2 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-2">
          <p className="text-red-300 text-[11px] font-mono leading-relaxed border-l border-red-500/50 pl-2">
            {entry.errorMessage}
          </p>
        </div>
      )}
    </div>
  );
}

interface ActivityFeedProps {
  logs: BotLogEntry[];
  bounties: FeedBountyItem[];
  total: number;
  totalErrors: number; // from stats — accurate across full history, not just loaded slice
  botUsername: string;
}

function buildBountyEvents(bounties: FeedBountyItem[], botUsername: string): FeedItem[] {
  return bounties.map((b) => ({
    id: `bounty-posted-${b.bountyId}`,
    timestamp: b.createdAt,
    triggerCastHash: "",
    triggerAuthor: botUsername,
    triggerText: `bounty #${b.bountyId} posted`,
    action: "bounty_posted_ui",
    replyText: `"${b.name}" · ${b.amountEth} ${b.chain === "degen" ? "DEGEN" : "ETH"} · ${b.chain}`,
    status: "success",
  }));
}

export function ActivityFeed({ logs: initialLogs, bounties, total, totalErrors, botUsername }: ActivityFeedProps) {
  const [filter, setFilter] = useState<"all" | "chat" | "system" | "errors">("all");
  const [logs, setLogs] = useState<BotLogEntry[]>(initialLogs);
  const bountyEvents = buildBountyEvents(bounties, botUsername);
  const bountyEventCount = bountyEvents.length;
  const logsCount = total;
  const merged = [...logs, ...bountyEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  const filtered = merged.filter((l) => {
    if (filter === "errors") return l.status === "error";
    if (filter === "chat") return CHAT_ACTIONS.has(l.action);
    if (filter === "system") return !CHAT_ACTIONS.has(l.action) && l.status !== "error";
    return true;
  });
  const allCount = merged.length;
  const chatCount = merged.filter((l) => CHAT_ACTIONS.has(l.action)).length;
  const systemCount = merged.filter((l) => !CHAT_ACTIONS.has(l.action) && l.status !== "error").length;
  const errorsCount = Math.max(merged.filter((l) => l.status === "error").length, totalErrors);

  // Keep local pagination state in sync with fresh server props on dashboard refresh.
  useEffect(() => {
    setLogs(initialLogs);
  }, [initialLogs, total]);

  if (merged.length === 0) {
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
    <div className="max-h-[56dvh] md:max-h-[65vh] overflow-y-auto">
      {/* Filter tabs */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/10 bg-[#111]/95 backdrop-blur">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilter("all")}
            className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors ${
              filter === "all" ? "bg-white/12 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            all ({allCount})
          </button>
          <button
            onClick={() => setFilter("chat")}
            className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors ${
              filter === "chat" ? "bg-white/12 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            chat ({chatCount})
          </button>
          <button
            onClick={() => setFilter("system")}
            className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors ${
              filter === "system" ? "bg-white/12 text-white" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            system ({systemCount})
          </button>
          <button
            onClick={() => setFilter("errors")}
            className={`text-[11px] font-mono px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              filter === "errors"
                ? "bg-red-500/20 text-red-400"
                : errorsCount > 0
                ? "text-red-500 hover:text-red-400"
                : "text-gray-600 cursor-default"
            }`}
            disabled={errorsCount === 0}
          >
            errors
            {errorsCount > 0 && (
              <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${filter === "errors" ? "bg-red-500/30" : "bg-red-500/20"}`}>
                {errorsCount}
              </span>
            )}
            {errorsCount === 0 && " (0)"}
          </button>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">
          {logsCount} logs + {bountyEventCount} posts
        </span>
      </div>

      {/* Empty state for errors filter — genuinely none */}
      {filtered.length === 0 && filter === "errors" && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <p className="text-green-500 font-mono text-sm">✓ no errors</p>
          <p className="text-gray-600 font-mono text-[10px] mt-1">all systems nominal</p>
        </div>
      )}

      {filtered.map((entry) => (
        <LogRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
