"use client";

import { useState } from "react";
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
    <div className={`border-b border-white/5 py-3 last:border-0 ${isError ? "bg-red-500/5" : ""}`}>
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
  botUsername: string;
}

export function ActivityFeed({ logs, botUsername }: ActivityFeedProps) {
  const [filter, setFilter] = useState<"all" | "errors">("all");

  const errorCount = logs.filter((l) => l.status === "error").length;
  const filtered = filter === "errors" ? logs.filter((l) => l.status === "error") : logs;

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
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-white/5">
        <button
          onClick={() => setFilter("all")}
          className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors ${
            filter === "all"
              ? "bg-white/10 text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          all ({logs.length})
        </button>
        <button
          onClick={() => setFilter("errors")}
          className={`text-[10px] font-mono px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
            filter === "errors"
              ? "bg-red-500/20 text-red-400"
              : errorCount > 0
              ? "text-red-500 hover:text-red-400"
              : "text-gray-600 cursor-default"
          }`}
          disabled={errorCount === 0}
        >
          errors
          {errorCount > 0 && (
            <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${filter === "errors" ? "bg-red-500/30" : "bg-red-500/20"}`}>
              {errorCount}
            </span>
          )}
          {errorCount === 0 && " (0)"}
        </button>
      </div>

      {/* Empty state for errors filter */}
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
