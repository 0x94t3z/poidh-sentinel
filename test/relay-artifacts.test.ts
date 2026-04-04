import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { BountyTuple, ClaimEvaluation, ClaimTuple } from "../src/core/types.js";
import type { SocialTarget } from "../src/core/social.js";
import { writeDecisionArtifacts } from "../src/runtime/decisionArtifacts.js";
import {
  findRelayStateByCastHash,
  loadRelayState,
  recordRelayStateUpdate,
  writeRelayArtifacts
} from "../src/runtime/relayState.js";

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

function buildClaimEvaluation(overrides?: Partial<ClaimTuple>): ClaimEvaluation {
  const claim: ClaimTuple = {
    id: 331n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 80n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Blue bottle proof",
    description: "A clear outdoor photo with a blue object.",
    createdAt: 123456n,
    accepted: true,
    ...overrides
  };

  return {
    claim,
    score: 82,
    reasons: ["Name overlap matched blue.", "Proof resolves to an image."],
    evidence: {
      tokenUri: "ipfs://claim-331",
      contentUri: "ipfs://claim-331-image",
      contentType: "image/jpeg",
      title: "Blue bottle outdoors",
      text: "Proof photo taken outside with a timestamp and the object in frame.",
      imageUrl: "ipfs://claim-331-image",
      rawMetadata: { image: "ipfs://claim-331-image" }
    }
  };
}

test("writes decision and social artifacts with the expected summary fields", async () => {
  const artifactDir = await makeTempDir("poidh-artifacts-");
  const bounty: BountyTuple = {
    id: 80n,
    issuer: "0x2222222222222222222222222222222222222222",
    name: "Take a photo of something blue outdoors",
    description: "Upload a clear outdoor photo of something blue.",
    amount: 1_000_000_000_000_000n,
    claimer: "0x3333333333333333333333333333333333333333",
    createdAt: 123456n,
    claimId: 331n
  };
  const evaluation = buildClaimEvaluation();

  const result = await writeDecisionArtifacts({
    artifactDir,
    chainName: "arbitrum",
    issuerAddress: "0x2222222222222222222222222222222222222222",
    bountyId: 80n,
    bounty,
    bountyUrl: "https://poidh.xyz/arbitrum/bounty/260",
    bountyTxHash: "0xaaaa",
    claimId: "331",
    claimTxHash: "0xbbbb",
    submittedClaims: [
      {
        claimId: "331",
        claimTxHash: "0xbbbb",
        claimantAddress: "0x3333333333333333333333333333333333333333",
        name: "Blue bottle proof",
        description: "A clear outdoor photo with a blue object."
      }
    ],
    finalActionTxHash: "0xcccc",
    winnerClaimId: 331n,
    evaluations: [evaluation],
    reason: "Name overlap matched blue. Proof resolves to an image.",
    author: "0x94t3z.eth"
  });

  const decisionJson = JSON.parse(await readFile(result.reportPaths.jsonPath, "utf8")) as {
    bountyId: string;
    winnerClaimId: string;
    finalActionTxHash?: string;
    evaluations: Array<{ claimId: string; score: number; accepted: boolean }>;
  };
  const socialJson = JSON.parse(await readFile(result.socialPaths.jsonPath, "utf8")) as {
    bountyId: string;
    reason: string;
    followUpAnswers: Array<{ question: string; answer: string }>;
  };
  const farcasterMarkdown = await readFile(result.farcasterPaths.markdownPath, "utf8");
  const socialMarkdown = await readFile(result.socialPaths.markdownPath, "utf8");

  assert.equal(decisionJson.bountyId, "80");
  assert.equal(decisionJson.winnerClaimId, "331");
  assert.equal(decisionJson.finalActionTxHash, "0xcccc");
  assert.equal(decisionJson.evaluations[0].claimId, "331");
  assert.equal(decisionJson.evaluations[0].score, 82);
  assert.equal(socialJson.bountyId, "80");
  assert.match(socialJson.reason, /image/i);
  assert.ok(
    socialJson.followUpAnswers.some((item) => item.question === "Was the payout handled on-chain?")
  );
  assert.match(farcasterMarkdown, /poidh decision/i);
  assert.match(socialMarkdown, /Why did this claim win\?/);
  assert.match(socialMarkdown, /Was the payout handled on-chain\?/);
});

test("persists relay state and can find replies by cast hash", async () => {
  const relayDir = await makeTempDir("poidh-relay-");
  const productionDir = await makeTempDir("poidh-production-");
  const previousRelayDir = process.env.RELAY_OUTPUT_DIR;
  const previousArtifactDir = process.env.ARTIFACT_DIR;

  process.env.RELAY_OUTPUT_DIR = relayDir;
  process.env.ARTIFACT_DIR = productionDir;

  try {
    const state = {
      generatedAt: "2026-04-05T00:00:00.000Z",
      sourceIp: "127.0.0.1",
      envelope: {
        targets: ["farcaster"] as SocialTarget[],
        message: "decision ready",
        castDraft: {
          text: "decision thread",
          embeds: [{ url: "https://poidh.xyz/arbitrum/bounty/260" }],
          author: "0x94t3z.eth",
          parentUrl: "https://poidh.xyz/arbitrum/bounty/260"
        },
        decision: {
          bountyId: 80n,
          bountyTitle: "Take a photo of something blue outdoors",
          winningClaimId: 331n,
          reason: "Name overlap matched blue.",
          url: "https://poidh.xyz/arbitrum/bounty/260"
        },
        followUpAnswers: [
          {
            question: "Why did this claim win?",
            answer: "Name overlap matched blue."
          }
        ]
      },
      publishedToFarcaster: false,
      farcasterCastIds: [],
      followUpReplies: []
    };

    await writeRelayArtifacts(state);

    const loaded = await loadRelayState("80");
    assert.equal(loaded?.envelope.decision.winningClaimId, 331n);
    assert.equal(loaded?.followUpReplies.length, 0);

    const updated = await recordRelayStateUpdate("80", (current) => ({
      ...current,
      publishedToFarcaster: true,
      farcasterCastIds: ["0xabc123"]
    }));

    assert.equal(updated.publishedToFarcaster, true);
    assert.deepEqual(updated.farcasterCastIds, ["0xabc123"]);

    const found = await findRelayStateByCastHash("0xabc123");
    assert.equal(found?.envelope.decision.bountyId, 80n);
    assert.equal(found?.publishedToFarcaster, true);
  } finally {
    process.env.RELAY_OUTPUT_DIR = previousRelayDir;
    process.env.ARTIFACT_DIR = previousArtifactDir;
  }
});
