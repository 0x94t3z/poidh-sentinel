"use client";

interface StatsBarProps {
  total: number;
  success: number;
  errors: number;
  lastActivity: string | null;
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center bg-black/40 rounded-lg px-4 py-3 flex-1 min-w-0">
      <span className={`text-2xl font-mono font-bold ${color}`}>{value}</span>
      <span className="text-gray-500 text-xs font-mono mt-0.5 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function StatsBar({ total, success, errors, lastActivity }: StatsBarProps) {
  const lastSeen = lastActivity
    ? new Date(lastActivity).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <StatPill label="logs" value={total} color="text-white" />
        <StatPill label="ok" value={success} color="text-green-400" />
        <StatPill label="errors" value={errors} color={errors > 0 ? "text-red-400" : "text-gray-600"} />
      </div>
      <p className="text-xs text-gray-600 font-mono text-right">
        last event: <span className="text-gray-400">{lastSeen}</span>
      </p>
    </div>
  );
}
