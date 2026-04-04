import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ClaimEvaluation } from "./types.js";

export type DemoArtifact = {
  generatedAt: string;
  chainName: string;
  issuerAddress: string;
  claimantAddress?: string;
  bountyId: string;
  bountyUrl: string;
  bountyName: string;
  bountyDescription: string;
  bountyAmountWei: string;
  bountyTxHash?: string;
  claimId?: string;
  claimTxHash?: string;
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

  if (artifact.claimantAddress) {
    lines.push(`- Claimant address: ${artifact.claimantAddress}`);
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

export function summarizeEvaluations(evaluations: ClaimEvaluation[]) {
  return evaluations.map((evaluation) => ({
    claimId: evaluation.claim.id.toString(),
    score: evaluation.score,
    accepted: evaluation.claim.accepted,
    proof: evaluation.evidence.contentUri,
    reasons: evaluation.reasons
  }));
}
