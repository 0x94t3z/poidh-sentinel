"use client";

import { useEffect, useState } from "react";

interface BotStatus {
  ready: boolean;
  config: {
    neynarApiKey: boolean;
    openRouterKey: boolean;
    groqKey: boolean;
    signerUuid: boolean;
    webhookSecret: boolean;
    walletKey: boolean;
  };
  wallet: {
    address: string;
  };
  bounties: {
    total: number;
    open: number;
    closed: number;
  };
  botFid: number;
  botUsername: string;
  webhookEndpoint: string;
}

function ConfigRow({ label, ok, optional }: { label: string; ok: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-gray-400 font-mono">{label}{optional && <span className="text-gray-600 ml-1">(opt)</span>}</span>
      <span className={`text-[11px] font-mono font-bold ${ok ? "text-green-400" : optional ? "text-gray-600" : "text-red-400"}`}>
        {ok ? "● SET" : "○ MISSING"}
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy address"}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 shrink-0"
      style={{
        background: copied ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.05)",
        color: copied ? "#4ade80" : "#6b7280",
      }}
    >
      {copied ? (
        // Checkmark icon
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        // Copy icon
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
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

  const walletAddress = status.wallet?.address && status.wallet.address !== "not configured"
    ? status.wallet.address
    : null;
  const walletShort = walletAddress
    ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
    : null;

  return (
    <div className="rounded-xl border border-white/10 bg-[#111] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${status.ready ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-amber-400"}`} />
          <span className="text-white font-mono text-sm font-semibold">@{status.botUsername}</span>
          {status.botFid > 0 && <span className="text-gray-600 font-mono text-[10px]">fid:{status.botFid}</span>}
        </div>
        <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${status.ready ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
          {status.ready ? "ACTIVE" : "NEEDS CONFIG"}
        </span>
      </div>

      {/* Wallet address — show when configured, with copy button */}
      {walletAddress && walletShort && (
        <div className="flex items-center justify-between gap-2 bg-black/30 rounded-lg px-3 py-2">
          <div className="min-w-0">
            <p className="text-[9px] text-gray-600 font-mono uppercase tracking-wider mb-0.5">bot wallet</p>
            <p className="text-[11px] text-gray-300 font-mono truncate">{walletShort}</p>
          </div>
          <CopyButton text={walletAddress} />
        </div>
      )}

      {/* Config rows — always show so operators can see what's set */}
      <div className="bg-black/30 rounded-lg px-3 py-1">
        <ConfigRow label="NEYNAR_API_KEY" ok={status.config.neynarApiKey} />
        <ConfigRow label="BOT_SIGNER_UUID" ok={status.config.signerUuid} />
        <ConfigRow label="BOT_WALLET_PRIVATE_KEY" ok={status.config.walletKey} />
        <ConfigRow label="GROQ_API_KEY" ok={status.config.groqKey} optional />
        <ConfigRow label="OPENROUTER_API_KEY" ok={status.config.openRouterKey} optional />
        <ConfigRow label="NEYNAR_WEBHOOK_SECRET" ok={status.config.webhookSecret} optional />
      </div>
    </div>
  );
}
