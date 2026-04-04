import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClaimEvaluation } from "./types.js";
import type { FarcasterCastDraft } from "./social.js";

export type DemoArtifact = {
  generatedAt: string;
  chainName: string;
  issuerAddress: string;
  issuerPendingWithdrawalsWei?: string;
  bountyId: string;
  bountyUrl: string;
  bountyName: string;
  bountyDescription: string;
  bountyAmountWei: string;
  bountyTxHash?: string;
  claimId?: string;
  claimTxHash?: string;
  submittedClaims?: Array<{
    claimId: string;
    claimTxHash: string;
    claimantAddress: string;
    name: string;
    description: string;
  }>;
  finalActionTxHash?: string;
  winnerClaimId?: string;
  evaluations: Array<{
    claimId: string;
    score: number;
    accepted: boolean;
    proof: string;
    reasons: string[];
  }>;
};

export type SocialProofArtifact = {
  generatedAt: string;
  chainName: string;
  bountyId: string;
  bountyUrl: string;
  bountyTitle: string;
  winnerClaimId: string;
  reason: string;
  author?: string;
  post: string;
  followUpAnswers: Array<{
    question: string;
    answer: string;
  }>;
};

export type FarcasterProofArtifact = {
  generatedAt: string;
  chainName: string;
  bountyId: string;
  bountyUrl: string;
  bountyTitle: string;
  winnerClaimId: string;
  cast: FarcasterCastDraft;
};

function markdownLines(artifact: DemoArtifact): string[] {
  const lines = [
    `# poidh demo report`,
    ``,
    `- Generated at: ${artifact.generatedAt}`,
    `- Chain: ${artifact.chainName}`,
    `- Bounty ID: ${artifact.bountyId}`,
    `- Bounty URL: ${artifact.bountyUrl}`,
    `- Bounty name: ${artifact.bountyName}`,
    `- Bounty description: ${artifact.bountyDescription}`,
    `- Bounty amount wei: ${artifact.bountyAmountWei}`,
    `- Issuer address: ${artifact.issuerAddress}`
  ];

  if (artifact.issuerPendingWithdrawalsWei) {
    lines.push(`- Issuer pending withdrawals wei: ${artifact.issuerPendingWithdrawalsWei}`);
  }
  if (artifact.bountyTxHash) {
    lines.push(`- Bounty tx: ${artifact.bountyTxHash}`);
  }
  if (artifact.claimId) {
    lines.push(`- Claim ID: ${artifact.claimId}`);
  }
  if (artifact.claimTxHash) {
    lines.push(`- Claim tx: ${artifact.claimTxHash}`);
  }
  if (artifact.winnerClaimId) {
    lines.push(`- Winner claim: ${artifact.winnerClaimId}`);
  }
  if (artifact.finalActionTxHash) {
    lines.push(`- Final action tx: ${artifact.finalActionTxHash}`);
  }

  if (artifact.submittedClaims && artifact.submittedClaims.length > 0) {
    lines.push(``, `## Submitted Claims`, ``);
    for (const claim of artifact.submittedClaims) {
      lines.push(`- Claim ${claim.claimId} by ${claim.claimantAddress}`);
      lines.push(`  - Tx: ${claim.claimTxHash}`);
      lines.push(`  - Name: ${claim.name}`);
      lines.push(`  - Description: ${claim.description}`);
    }
  }

  lines.push(``, `## Evaluations`, ``);
  for (const evaluation of artifact.evaluations) {
    lines.push(
      `- Claim ${evaluation.claimId}: score ${evaluation.score}, accepted ${evaluation.accepted}, proof ${evaluation.proof}`
    );
    for (const reason of evaluation.reasons) {
      lines.push(`  - ${reason}`);
    }
  }

  return lines;
}

export async function writeDemoArtifact(
  artifactDir: string,
  artifact: DemoArtifact
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(artifactDir, { recursive: true });
  const baseName = `poidh-demo-${artifact.bountyId}`;
  const jsonPath = join(artifactDir, `${baseName}.json`);
  const markdownPath = join(artifactDir, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${markdownLines(artifact).join("\n")}\n`, "utf8");

  return { jsonPath, markdownPath };
}

function socialLines(artifact: SocialProofArtifact): string[] {
  const lines = [
    `# poidh social proof`,
    ``,
    `- Generated at: ${artifact.generatedAt}`,
    `- Chain: ${artifact.chainName}`,
    `- Bounty ID: ${artifact.bountyId}`,
    `- Bounty URL: ${artifact.bountyUrl}`,
    `- Bounty title: ${artifact.bountyTitle}`,
    `- Winner claim: ${artifact.winnerClaimId}`,
    `- Reason: ${artifact.reason}`,
    `- Post:`,
    `  ${artifact.post}`
  ];

  if (artifact.author) {
    lines.push(`- Author: ${artifact.author}`);
  }

  lines.push(``, `## Follow-up Answers`, ``);
  for (const item of artifact.followUpAnswers) {
    lines.push(`- ${item.question}`);
    lines.push(`  - ${item.answer}`);
  }

  return lines;
}

export async function writeSocialProofArtifact(
  artifactDir: string,
  artifact: SocialProofArtifact
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(artifactDir, { recursive: true });
  const baseName = `poidh-social-${artifact.bountyId}`;
  const jsonPath = join(artifactDir, `${baseName}.json`);
  const markdownPath = join(artifactDir, `${baseName}.md`);

  await writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${socialLines(artifact).join("\n")}\n`, "utf8");

  return { jsonPath, markdownPath };
}

export async function writeFarcasterProofArtifact(
  artifactDir: string,
  artifact: FarcasterProofArtifact
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(artifactDir, { recursive: true });
  const baseName = `poidh-farcaster-${artifact.bountyId}`;
  const jsonPath = join(artifactDir, `${baseName}.json`);
  const markdownPath = join(artifactDir, `${baseName}.md`);

  const lines = [
    `# poidh farcaster proof`,
    ``,
    `- Generated at: ${artifact.generatedAt}`,
    `- Chain: ${artifact.chainName}`,
    `- Bounty ID: ${artifact.bountyId}`,
    `- Bounty URL: ${artifact.bountyUrl}`,
    `- Bounty title: ${artifact.bountyTitle}`,
    `- Winner claim: ${artifact.winnerClaimId}`,
    `- Cast text:`,
    `  ${artifact.cast.text}`,
    artifact.cast.author ? `- Author: ${artifact.cast.author}` : undefined,
    artifact.cast.parentUrl ? `- Parent URL: ${artifact.cast.parentUrl}` : undefined
  ].filter(Boolean) as string[];

  if (artifact.cast.embeds.length > 0) {
    lines.push(``, `## Embeds`, ``);
    for (const embed of artifact.cast.embeds) {
      lines.push(`- ${embed.url}`);
    }
  }

  await writeFile(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${lines.join("\n")}\n`, "utf8");

  return { jsonPath, markdownPath };
}

export function summarizeEvaluations(evaluations: ClaimEvaluation[]) {
  return evaluations.map((evaluation) => ({
    claimId: evaluation.claim.id.toString(),
    score: evaluation.score,
    accepted: evaluation.claim.accepted,
    proof: evaluation.evidence.contentUri,
    reasons: evaluation.reasons
  }));
}
