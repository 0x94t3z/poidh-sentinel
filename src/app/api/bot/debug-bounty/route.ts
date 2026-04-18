import { NextRequest, NextResponse } from "next/server";
import { getActiveBounty } from "@/db/actions/bot-actions";
import { getBountyDetails, getClaimsForBounty, resolveBountyWinner } from "@/features/bot/poidh-contract";
import { MIN_OPEN_DURATION_HOURS } from "@/features/bot/constants";
import { pickWinner, compareEvaluationResults, type ClaimData, type EvaluationResult } from "@/features/bot/submission-evaluator";
import { checkAdminAuth } from "@/lib/admin-auth";

function selectWinnerFromStoredResults(
  allResults?: EvaluationResult[],
): { winnerClaimId: string; reasoning: string; allResults: EvaluationResult[] } | null {
  if (!allResults?.length) return null;
  const validResults = allResults
    .filter((r) => r.valid && r.score >= 60)
    .sort(compareEvaluationResults);
  if (validResults.length === 0) return null;
  const winner = validResults[0];
  return {
    winnerClaimId: winner.claimId,
    reasoning: winner.reasoning,
    allResults,
  };
}

function hasSameClaimSet(
  claims: ClaimData[],
  allResults?: EvaluationResult[],
): boolean {
  if (!allResults?.length || claims.length !== allResults.length) return false;
  const claimIds = new Set(claims.map((claim) => claim.id));
  return allResults.every((result) => claimIds.has(result.claimId));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const unauth = checkAdminAuth(req);
  if (unauth) return unauth;

  const { searchParams } = req.nextUrl;
  const bountyId = searchParams.get("bountyId");
  const chain = (searchParams.get("chain") ?? "arbitrum").toLowerCase();
  const attemptResolve = searchParams.get("resolve") === "1";

  if (!bountyId) {
    return NextResponse.json({ error: "bountyId is required" }, { status: 400 });
  }

  const bounty = await getActiveBounty(bountyId);
  if (!bounty) {
    return NextResponse.json({ error: `bounty ${bountyId} not found in active_bounties` }, { status: 404 });
  }

  const details = await getBountyDetails(BigInt(bountyId), chain);
  const claims = await getClaimsForBounty(BigInt(bountyId), chain);
  const claimData: ClaimData[] = claims.map((c) => ({
    id: c.id.toString(),
    issuer: c.issuer,
    name: c.name,
    description: c.description,
    uri: c.uri,
  }));

  const result = await pickWinner(
    bounty.name,
    bounty.description,
    claimData,
    details.createdAt,
    { returnAllResultsIfNoWinner: true },
  );

  const sameClaimSetAsStored = hasSameClaimSet(claimData, bounty.allEvalResults);
  const previousWinnerResult = sameClaimSetAsStored
    ? selectWinnerFromStoredResults(bounty.allEvalResults)
    : null;
  const effectiveResult = result?.winnerClaimId
    ? result
    : previousWinnerResult;

  const createdAtMs = Number(details.createdAt) * 1000;
  const ageHours = (Date.now() - createdAtMs) / (60 * 60 * 1000);
  const lastCheckedAtMs = bounty.lastCheckedAt ? new Date(bounty.lastCheckedAt).getTime() : null;
  const sinceLastCheckedHours = lastCheckedAtMs
    ? (Date.now() - lastCheckedAtMs) / (60 * 60 * 1000)
    : null;

  let resolutionAttempt:
    | {
        attempted: false;
        reason: string;
      }
    | {
        attempted: true;
        method?: "direct" | "vote_submitted" | "vote_resolved";
        txHash?: `0x${string}`;
        error?: string;
      };

  if (!attemptResolve) {
    resolutionAttempt = {
      attempted: false,
      reason: "pass resolve=1 to attempt on-chain winner resolution",
    };
  } else if (!effectiveResult?.winnerClaimId) {
    resolutionAttempt = {
      attempted: false,
      reason: "no effective winner candidate to resolve",
    };
  } else {
    try {
      const resolution = await resolveBountyWinner(
        BigInt(bountyId),
        BigInt(effectiveResult.winnerClaimId),
        chain,
      );
      resolutionAttempt = {
        attempted: true,
        method: resolution.method,
        txHash: resolution.txHash,
      };
    } catch (err) {
      resolutionAttempt = {
        attempted: true,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return NextResponse.json({
    bounty: {
      bountyId,
      chain,
      row: bounty,
      contract: {
        name: details.name,
        description: details.description,
        amountWei: details.amount.toString(),
        createdAt: details.createdAt.toString(),
        ageHours: Number(ageHours.toFixed(2)),
        minOpenHours: MIN_OPEN_DURATION_HOURS,
        eligibleByAge: ageHours >= MIN_OPEN_DURATION_HOURS,
        claimer: details.claimer,
      },
      lastCheckedAt: bounty.lastCheckedAt ?? null,
      sinceLastCheckedHours: sinceLastCheckedHours === null ? null : Number(sinceLastCheckedHours.toFixed(2)),
    },
    claims: {
      count: claimData.length,
      ids: claimData.map((claim) => claim.id),
      items: claimData,
    },
    evaluation: {
      directResult: result,
      sameClaimSetAsStored,
      previousWinnerResult,
      effectiveResult,
    },
    resolutionAttempt,
  });
}
