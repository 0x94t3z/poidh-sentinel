"use client";

import { useEffect, useState } from "react";

interface BotStatus {
  ready: boolean;
  config: {
    neynarApiKey: boolean;
    openRouterKey: boolean;
    signerUuid: boolean;
    webhookSecret: boolean;
  };
  botFid: number;
  botUsername: string;
  webhookEndpoint: string;
}

function ConfigRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-400 font-mono">{label}</span>
      <span className={`text-xs font-mono font-bold ${ok ? "text-green-400" : "text-red-400"}`}>
        {ok ? "● SET" : "○ MISSING"}
      </span>
    </div>
  );
}

export function StatusCard() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/bot/status");
        const data = (await res.json()) as BotStatus;
        setStatus(data);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    void fetchStatus();
    const interval = setInterval(() => void fetchStatus(), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#111] p-4">
        <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-3" />
        <div className="h-3 w-full bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-[#111] p-4">
        <p className="text-red-400 text-xs font-mono">failed to load status</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#111] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${status.ready ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-amber-400"}`} />
          <span className="text-white font-mono text-sm font-semibold">
            @{status.botUsername}
          </span>
          <span className="text-gray-500 font-mono text-xs">fid:{status.botFid}</span>
        </div>
        <span className={`text-xs font-mono px-2 py-0.5 rounded ${status.ready ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
          {status.ready ? "ACTIVE" : "NEEDS CONFIG"}
        </span>
      </div>

      {/* Config checks */}
      <div className="bg-black/30 rounded-lg px-3 py-1">
        <ConfigRow label="NEYNAR_API_KEY" ok={status.config.neynarApiKey} />
        <ConfigRow label="OPENROUTER_API_KEY" ok={status.config.openRouterKey} />
        <ConfigRow label="BOT_SIGNER_UUID" ok={status.config.signerUuid} />
        <ConfigRow label="NEYNAR_WEBHOOK_SECRET" ok={status.config.webhookSecret} />
      </div>

      {/* Webhook URL */}
      <div className="bg-black/30 rounded-lg p-3">
        <p className="text-xs text-gray-500 font-mono mb-1">webhook endpoint</p>
        <p className="text-xs text-green-400 font-mono break-all">{status.webhookEndpoint}</p>
        <p className="text-xs text-gray-600 mt-1 font-mono">point your neynar webhook here</p>
      </div>
    </div>
  );
}
