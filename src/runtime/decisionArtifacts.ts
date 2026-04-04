import type { BountyTuple, ChainName, ClaimEvaluation } from "../core/types.js";
import {
  summarizeEvaluations,
  writeDecisionArtifact,
  writeFarcasterProofArtifact,
  writeSocialProofArtifact
} from "../core/artifacts.js";
import { resolveFrontendBountyUrl } from "../core/chains.js";
import { buildFarcasterCastDraft, buildFollowUpAnswers } from "../core/social.js";

export type DecisionArtifactsInput = {
  artifactDir: string;
  chainName: ChainName;
  issuerAddress: `0x${string}`;
  issuerPendingWithdrawalsWei?: string;
  bountyId: bigint;
  bounty: BountyTuple;
  declaredBountyAmountWei?: bigint;
  bountyUrl?: string;
  bountyTxHash?: `0x${string}`;
  claimId?: string;
  claimTxHash?: `0x${string}`;
  submittedClaims?: Array<{
    claimId: string;
    claimTxHash: `0x${string}`;
    claimantAddress: string;
    name: string;
    description: string;
  }>;
  finalActionTxHash?: `0x${string}`;
  winnerClaimId: bigint;
  evaluations: ClaimEvaluation[];
  reason: string;
  author?: string;
};

export async function writeDecisionArtifacts(input: DecisionArtifactsInput) {
  const bountyUrl = input.bountyUrl ?? resolveFrontendBountyUrl(input.chainName, input.bountyId);
  const currentChainBountyAmountWei = input.bounty.amount.toString();
  const declaredBountyAmountWei = input.declaredBountyAmountWei?.toString();
  const artifact = {
    generatedAt: new Date().toISOString(),
    chainName: input.chainName,
    issuerAddress: input.issuerAddress,
    issuerPendingWithdrawalsWei: input.issuerPendingWithdrawalsWei,
    bountyId: input.bountyId.toString(),
    bountyUrl,
    bountyName: input.bounty.name,
    bountyDescription: input.bounty.description,
    bountyAmountWei: declaredBountyAmountWei ?? currentChainBountyAmountWei,
    currentChainBountyAmountWei,
    bountyTxHash: input.bountyTxHash,
    claimId: input.claimId,
    claimTxHash: input.claimTxHash,
    submittedClaims: input.submittedClaims,
    finalActionTxHash: input.finalActionTxHash,
    winnerClaimId: input.winnerClaimId.toString(),
    evaluations: summarizeEvaluations(input.evaluations)
  };

  const reportPaths = await writeDecisionArtifact(input.artifactDir, artifact);
  const socialPaths = await writeSocialProofArtifact(input.artifactDir, {
    generatedAt: new Date().toISOString(),
    chainName: input.chainName,
    bountyId: input.bountyId.toString(),
    bountyUrl,
    bountyTitle: input.bounty.name,
    winnerClaimId: input.winnerClaimId.toString(),
    reason: input.reason,
    bountyAmountWei: declaredBountyAmountWei ?? currentChainBountyAmountWei,
    currentChainBountyAmountWei,
    author: input.author,
    post: [
      `poidh decision for bounty ${input.bountyId.toString()}: ${input.bounty.name}`,
      `winner claim: ${input.winnerClaimId.toString()}`,
      `reason: ${input.reason}`,
      `url: ${bountyUrl}`
    ].join("\n"),
    followUpAnswers: [
      ...buildFollowUpAnswers(input.reason),
      {
        question: "Was the payout handled on-chain?",
        answer: input.finalActionTxHash
          ? `Yes, the final action transaction was ${input.finalActionTxHash}.`
          : "The bot has not submitted a final on-chain action yet."
      }
    ]
  });
  const farcasterPaths = await writeFarcasterProofArtifact(input.artifactDir, {
    generatedAt: new Date().toISOString(),
    chainName: input.chainName,
    bountyId: input.bountyId.toString(),
    bountyUrl,
    bountyTitle: input.bounty.name,
    winnerClaimId: input.winnerClaimId.toString(),
    bountyAmountWei: declaredBountyAmountWei ?? currentChainBountyAmountWei,
    currentChainBountyAmountWei,
    cast: buildFarcasterCastDraft(
      {
        bountyId: input.bountyId,
        bountyTitle: input.bounty.name,
        winningClaimId: input.winnerClaimId,
        reason: input.reason,
        url: bountyUrl
      },
      input.author
    )
  });

  return { artifact, reportPaths, socialPaths, farcasterPaths };
}
