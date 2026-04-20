import { NextRequest, NextResponse } from "next/server";
import { parseEther } from "viem";
import { getAllBounties, updateBounty } from "@/db/actions/bot-actions";
import {
  cancelBounty,
  getBountyDetails,
  getTxExplorerUrl,
  retryCancelledBountyRefundFromPending,
} from "@/features/bot/poidh-contract";
import { checkAdminAuth } from "@/lib/admin-auth";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

type BatchResult = {
  bountyId: string;
  chain: string;
  dbStatus: string;
  action:
    | "dry_run_cancel"
    | "dry_run_retry_refund"
    | "cancelled_refunded"
    | "cancelled_pending_refund"
    | "already_cancelled_refunded"
    | "already_cancelled_pending_refund"
    | "skipped_missing_creator_fid"
    | "skipped_missing_refund_address"
    | "skipped_already_closed_with_winner"
    | "failed";
  reason?: string;
  cancelTxHash?: string;
  refundTxHash?: string;
  explorerCancel?: string;
  explorerRefund?: string;
};

async function resolveFidToRefundAddress(fid: number): Promise<string | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      users?: Array<{
        custody_address?: string;
        verified_addresses?: { eth_addresses?: string[] };
      }>;
    };
    const user = data.users?.[0];
    if (!user) return null;
    return user.verified_addresses?.eth_addresses?.[0] ?? user.custody_address ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;

  const { searchParams } = req.nextUrl;
  const dryRun = searchParams.get("dryRun") === "1";
  const confirm = searchParams.get("confirm");
  const chainFilter = searchParams.get("chain")?.toLowerCase();
  const includeClosedPending = searchParams.get("includeClosedPending") === "1";

  if (!dryRun && confirm !== "cancel_all_bounties") {
    return NextResponse.json(
      { error: "Missing confirmation. Pass confirm=cancel_all_bounties or use dryRun=1 first." },
      { status: 400 },
    );
  }

  const all = await getAllBounties();
  const targets = all.filter((b) => {
    if (chainFilter && b.chain !== chainFilter) return false;
    if (b.status !== "closed") return true;
    if (!includeClosedPending) return false;
    return !b.winnerTxHash && (b.winnerReasoning ?? "").toLowerCase().includes("refund pending");
  });

  const results: BatchResult[] = [];

  for (const bounty of targets) {
    const base = { bountyId: bounty.bountyId, chain: bounty.chain, dbStatus: bounty.status };
    const bountyAmountWei = parseEther(bounty.amountEth);

    if (!bounty.creatorFid) {
      results.push({
        ...base,
        action: "skipped_missing_creator_fid",
        reason: "creatorFid missing; cannot resolve creator refund address safely",
      });
      continue;
    }

    const refundAddress = await resolveFidToRefundAddress(bounty.creatorFid);
    if (!refundAddress) {
      results.push({
        ...base,
        action: "skipped_missing_refund_address",
        reason: `could not resolve refund address for creatorFid=${bounty.creatorFid}`,
      });
      continue;
    }

    try {
      const details = await getBountyDetails(BigInt(bounty.bountyId), bounty.chain);
      const isClosedOnChain = details.claimer !== ZERO_ADDR;
      const isCancelledOnChain = isClosedOnChain && details.claimer.toLowerCase() === details.issuer.toLowerCase();

      if (isClosedOnChain && !isCancelledOnChain) {
        results.push({
          ...base,
          action: "skipped_already_closed_with_winner",
          reason: "on-chain winner already finalized; cannot cancel",
        });
        continue;
      }

      if (!isCancelledOnChain) {
        if (dryRun) {
          results.push({ ...base, action: "dry_run_cancel", reason: `would cancel and refund to ${refundAddress}` });
          continue;
        }

        const cancel = await cancelBounty(
          BigInt(bounty.bountyId),
          bounty.chain,
          refundAddress,
          bountyAmountWei,
          bounty.bountyType ?? null,
        );

        let refundTxHash = cancel.refundTxHash;
        if (!refundTxHash) {
          try {
            const retry = await retryCancelledBountyRefundFromPending(
              BigInt(bounty.bountyId),
              bounty.chain,
              refundAddress,
              bountyAmountWei,
              { allowDirectWalletFallback: true },
            );
            refundTxHash = retry.refundTxHash;
          } catch {
            // Keep as pending; loop retry will handle it.
          }
        }

        await updateBounty(bounty.bountyId, {
          status: "closed",
          winnerReasoning: refundTxHash
            ? "bounty cancelled by admin batch (refund sent)"
            : "bounty cancelled by admin batch (refund pending)",
          winnerTxHash: refundTxHash ?? undefined,
        });

        results.push({
          ...base,
          action: refundTxHash ? "cancelled_refunded" : "cancelled_pending_refund",
          cancelTxHash: cancel.cancelTxHash,
          refundTxHash,
          explorerCancel: getTxExplorerUrl(bounty.chain, cancel.cancelTxHash),
          explorerRefund: refundTxHash ? getTxExplorerUrl(bounty.chain, refundTxHash) : undefined,
        });
        continue;
      }

      if (dryRun) {
        results.push({ ...base, action: "dry_run_retry_refund", reason: `would retry refund to ${refundAddress}` });
        continue;
      }

      const retry = await retryCancelledBountyRefundFromPending(
        BigInt(bounty.bountyId),
        bounty.chain,
        refundAddress,
        bountyAmountWei,
        { allowDirectWalletFallback: true },
      );

      await updateBounty(bounty.bountyId, {
        status: "closed",
        winnerReasoning: retry.refundTxHash
          ? "bounty cancelled by admin batch (refund sent)"
          : "bounty cancelled by admin batch (refund pending)",
        winnerTxHash: retry.refundTxHash ?? undefined,
      });

      results.push({
        ...base,
        action: retry.refundTxHash ? "already_cancelled_refunded" : "already_cancelled_pending_refund",
        refundTxHash: retry.refundTxHash,
        explorerRefund: retry.refundTxHash ? getTxExplorerUrl(bounty.chain, retry.refundTxHash) : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ ...base, action: "failed", reason: msg.slice(0, 240) });
    }
  }

  const summary = {
    totalTargets: targets.length,
    byAction: results.reduce<Record<string, number>>((acc, r) => {
      acc[r.action] = (acc[r.action] ?? 0) + 1;
      return acc;
    }, {}),
    dryRun,
    chainFilter: chainFilter ?? null,
    includeClosedPending,
  };

  return NextResponse.json({ ok: true, summary, results });
}
