"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusCard } from "@/features/bot/components/status-card";
import { StatsBar } from "@/features/bot/components/stats-bar";
import { ActivityFeed } from "@/features/bot/components/activity-feed";
import type { BotLogEntry } from "@/features/bot/types";

interface ActiveBounty {
  bountyId: string;
  txHash: string;
  name: string;
  amountEth: string;
  liveAmountEth: string | null;
  chain: string;
  createdAt: string;
  status: "open" | "evaluating" | "closed";
  claimCount: number;
  winnerClaimId?: string;
  winnerIssuer?: string;
  winnerUsername?: string | null;
  winnerTxHash?: string;
  winnerReasoning?: string;
}

interface LogsResponse {
  logs: BotLogEntry[];
  total: number;
  stats: {
    total: number;
    success: number;
    errors: number;
    lastActivity: string | null;
  };
}

interface BountiesResponse {
  bounties: ActiveBounty[];
}

const STATUS_COLOR: Record<string, string> = {
  open: "text-green-400",
  evaluating: "text-amber-400",
  closed: "text-gray-500",
  cancelled: "text-red-500",
};

const STATUS_DOT: Record<string, string> = {
  open: "bg-green-400 shadow-[0_0_4px_#4ade80]",
  evaluating: "bg-amber-400 shadow-[0_0_4px_#fbbf24]",
  closed: "bg-gray-600",
  cancelled: "bg-red-500",
};

const CHAIN_CURRENCY: Record<string, string> = {
  arbitrum: "ETH",
  base: "ETH",
  degen: "DEGEN",
};

const POIDH_OFFSETS: Record<string, number> = { arbitrum: 180, base: 986, degen: 1197 };

function poidhUrl(chain: string, rawBountyId: string): string {
  const slug = chain === "base" ? "base" : chain === "degen" ? "degen" : "arbitrum";
  const offset = POIDH_OFFSETS[slug] ?? 0;
  const displayId = BigInt(rawBountyId) + BigInt(offset);
  return `https://poidh.xyz/${slug}/bounty/${displayId}`;
}

export function Dashboard({ botUsername }: { botUsername: string }) {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [bounties, setBounties] = useState<ActiveBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const [logsRes, bountiesRes] = await Promise.all([
        fetch("/api/bot/logs?limit=all"),
        fetch("/api/bot/bounties"),
      ]);
      const logsJson = (await logsRes.json()) as LogsResponse;
      const bountiesJson = (await bountiesRes.json()) as BountiesResponse;
      setData(logsJson);
      setBounties(bountiesJson.bounties ?? []);
      setLastRefresh(new Date());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => void fetchAll(), 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const openBounties = bounties.filter((b) => b.status === "open").length;
  const currency = (b: ActiveBounty) => CHAIN_CURRENCY[b.chain] ?? "ETH";

  const STATUS_ORDER: Record<string, number> = { open: 0, evaluating: 1, closed: 2 };
  const sortedBounties = [...bounties].sort((a, b) => {
    const aOrder = a.winnerReasoning?.startsWith("bounty cancelled by") ? 3 : (STATUS_ORDER[a.status] ?? 2);
    const bOrder = b.winnerReasoning?.startsWith("bounty cancelled by") ? 3 : (STATUS_ORDER[b.status] ?? 2);
    return aOrder - bOrder;
  });

  const [showAllBounties, setShowAllBounties] = useState(false);
  const BOUNTIES_INITIAL = 5;
  const visibleBounties = showAllBounties ? sortedBounties : sortedBounties.slice(0, BOUNTIES_INITIAL);
  const hasMoreBounties = sortedBounties.length > BOUNTIES_INITIAL;

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white font-mono">
      {/* Header */}
      <div className="px-4 pt-6 pb-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white text-lg font-bold tracking-tight">poidh sentinel</h1>
            <p className="text-gray-500 text-xs mt-0.5">autonomous bounty agent · /poidh</p>
          </div>
          <button
            onClick={() => void fetchAll()}
            className="text-xs text-gray-500 hover:text-green-400 transition-colors px-3 py-1.5 rounded border border-white/10 hover:border-green-500/30"
          >
            ↺ refresh
          </button>
        </div>
      </div>

      <div className="px-4 pb-8 space-y-5 mt-5">
        {/* Status */}
        <section>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">bot status</p>
          <StatusCard />
        </section>

        {/* Stats */}
        {data && (
          <section>
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">activity</p>
            <StatsBar
              total={data.stats.total}
              success={data.stats.success}
              errors={data.stats.errors}
              lastActivity={data.stats.lastActivity}
            />
          </section>
        )}

        {/* On-chain bounties */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest">on-chain bounties</p>
            {bounties.length > 0 && (
              <span className="text-[10px] text-green-500 font-mono">{openBounties} open</span>
            )}
          </div>
          <div className="bg-[#111] rounded-xl border border-white/10 divide-y divide-white/5">
            {bounties.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-gray-500 text-xs">no bounties yet</p>
                <p className="text-gray-600 text-[10px] mt-1">mention @{botUsername} to create one</p>
              </div>
            ) : (
              visibleBounties.map((b) => {
                const isPending = b.bountyId.startsWith("pending-");
                return (
                  <div key={b.bountyId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-white text-xs font-bold leading-snug flex-1">{b.name}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full mt-0.5 ${STATUS_DOT[b.winnerReasoning?.startsWith("bounty cancelled by") ? "cancelled" : b.status] ?? "bg-gray-600"}`} />
                        <span className={`text-[10px] font-bold ${STATUS_COLOR[b.winnerReasoning?.startsWith("bounty cancelled by") ? "cancelled" : b.status] ?? "text-gray-500"}`}>
                          {b.winnerReasoning?.startsWith("bounty cancelled by") ? "CANCELLED" : b.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                      {b.liveAmountEth ? (
                        <span className={b.liveAmountEth !== b.amountEth ? "text-green-400 font-bold" : ""}>
                          {b.liveAmountEth} {currency(b)}
                          {b.liveAmountEth !== b.amountEth && (
                            <span className="ml-1 text-green-600 text-[9px]">↑ live</span>
                          )}
                        </span>
                      ) : (
                        <span>{b.amountEth} {currency(b)}</span>
                      )}
                      <span className="text-gray-600 capitalize">{b.chain}</span>
                      <span>{b.claimCount} claim{b.claimCount !== 1 ? "s" : ""}</span>
                      {isPending ? (
                        <span className="text-amber-500">pending tx…</span>
                      ) : (
                        <a
                          href={poidhUrl(b.chain, b.bountyId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-500 hover:text-green-300 transition-colors"
                        >
                          poidh.xyz ↗
                        </a>
                      )}
                    </div>
                    {/* Winner row — show on closed non-cancelled bounties */}
                    {b.status === "closed" && b.winnerIssuer && !b.winnerReasoning?.startsWith("bounty cancelled by") && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px]">🏆</span>
                        <span className="text-amber-400 text-[10px] font-mono">
                          {b.winnerUsername ? `@${b.winnerUsername}` : `${b.winnerIssuer.slice(0, 6)}…${b.winnerIssuer.slice(-4)}`}
                        </span>
                        {b.winnerReasoning && (
                          <>
                            <span className="text-amber-600 text-[10px]">·</span>
                            <span className="text-amber-400 text-[10px] italic">{b.winnerReasoning}</span>
                          </>
                        )}
                      </div>
                    )}
                    {/* Cancelled reason */}
                    {b.winnerReasoning?.startsWith("bounty cancelled by") && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[10px]">✕</span>
                        <span className="text-red-400 text-[10px] font-mono italic">{b.winnerReasoning}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {hasMoreBounties && (
              <button
                onClick={() => setShowAllBounties((v) => !v)}
                className="w-full px-4 py-2.5 text-[11px] font-mono text-gray-500 hover:text-green-400 transition-colors border-t border-white/5"
              >
                {showAllBounties
                  ? "show less ↑"
                  : `show ${sortedBounties.length - BOUNTIES_INITIAL} more ↓`}
              </button>
            )}
          </div>
        </section>

        {/* How it works */}
        <section>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">how it works</p>
          <div className="bg-[#111] rounded-xl border border-white/10 p-4 space-y-3">
            {[
              { step: "01", title: `mention @${botUsername}`, desc: "bot suggests a bounty idea for you to confirm" },
              { step: "02", title: "pick chain + amount", desc: "choose arbitrum, base, or degen and fund the bounty" },
              { step: "03", title: "bounty goes live", desc: "bot creates an open bounty on poidh.xyz — anyone can add funds" },
              { step: "04", title: "ai picks a winner", desc: "cron evaluates submissions every minute, picks best proof" },
              { step: "05", title: "ask about any image", desc: `tag @${botUsername} under a cast and ask "is this ai?" — bot runs forensic analysis and replies` },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <span className="text-green-500 text-xs font-bold shrink-0 mt-0.5">{item.step}</span>
                <div>
                  <p className="text-white text-xs font-bold">{item.title}</p>
                  <p className="text-gray-500 text-xs">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Activity feed */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">recent activity</p>
              {data && data.stats.errors > 0 && (
                <span className="text-[9px] font-bold font-mono bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                  {data.stats.errors} err
                </span>
              )}
            </div>
            {!loading && (
              <p className="text-[10px] text-gray-700">
                {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <div className="bg-[#111] rounded-xl border border-white/10 overflow-hidden">
            {loading ? (
              <div className="px-4 py-8 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-2.5 bg-white/5 rounded w-1/3 animate-pulse" />
                    <div className="h-2 bg-white/5 rounded w-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <ActivityFeed
                logs={data?.logs ?? []}
                bounties={bounties}
                total={data?.total ?? 0}
                totalErrors={data?.stats?.errors ?? 0}
                botUsername={botUsername}
              />
            )}
          </div>
        </section>

        {/* Wallet setup */}
        <section>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
            <p className="text-amber-400 text-xs font-bold">fund the bot wallet</p>
            <p className="text-gray-400 text-xs leading-relaxed">
              send gas to the bot wallet address shown above — ETH on arbitrum/base, DEGEN on degen chain. 0.005 ETH or ~500 DEGEN is enough for hundreds of transactions.
            </p>
            <p className="text-gray-500 text-xs leading-relaxed">
              anyone can top up an open bounty directly on poidh.xyz — just find the bounty and add funds.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
