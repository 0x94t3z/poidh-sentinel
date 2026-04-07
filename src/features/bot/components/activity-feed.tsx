"use client";

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
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="border-b border-white/5 py-3 last:border-0">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono font-bold ${actionMeta.color}`}>
            {actionMeta.label}
          </span>
          <span className="text-gray-500 font-mono text-[10px]">@{entry.triggerAuthor}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-mono ${entry.status === "success" ? "text-green-500" : "text-red-500"}`}
          >
            {entry.status === "success" ? "✓" : "✗"}
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

      {/* Error */}
      {entry.errorMessage && (
        <p className="text-red-400 text-[10px] font-mono mt-1">{entry.errorMessage}</p>
      )}
    </div>
  );
}

interface ActivityFeedProps {
  logs: BotLogEntry[];
}

export function ActivityFeed({ logs }: ActivityFeedProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="text-4xl mb-3">👻</span>
        <p className="text-gray-500 font-mono text-sm">no activity yet</p>
        <p className="text-gray-600 font-mono text-xs mt-1">
          mention @poidh-sentinel in a cast to trigger the bot
        </p>
      </div>
    );
  }

  return (
    <div>
      {logs.map((entry) => (
        <LogRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
