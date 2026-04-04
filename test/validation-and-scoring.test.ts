import assert from "node:assert/strict";
import test from "node:test";
import { validateRealWorldBounty } from "../src/runtime/bountyValidation.js";
import { scoreClaimWithEvidence } from "../src/core/evaluate.js";
import type { ClaimEvidence, ClaimTuple } from "../src/core/types.js";

test("rejects obviously digital-only bounty prompts", () => {
  const reasons = validateRealWorldBounty(
    "Post your GitHub repo",
    "Share the code and a JSON payload"
  );

  assert.ok(reasons.length > 0);
  assert.match(reasons.join(" "), /digital-only/i);
});

test("accepts a real-world photo bounty prompt", () => {
  const reasons = validateRealWorldBounty(
    "Take a photo of something blue outdoors",
    "Upload a clear outdoor photo of something blue."
  );

  assert.equal(reasons.length, 0);
});

test("scores real-world image claims higher and rewards accepted claims", () => {
  const claim: ClaimTuple = {
    id: 331n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 80n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Blue object proof",
    description: "Photo taken outdoors with a clear blue object and proof note.",
    createdAt: 123456n,
    accepted: true
  };

  const acceptedEvidence: ClaimEvidence = {
    tokenUri: "ipfs://claim-331",
    contentUri: "ipfs://claim-331-image",
    contentType: "image/jpeg",
    title: "Blue bottle outdoors",
    text: "Proof photo taken outside with a timestamp and the object in frame.",
    imageUrl: "ipfs://claim-331-image",
    rawMetadata: { image: "ipfs://claim-331-image" }
  };

  const unacceptedEvidence: ClaimEvidence = {
    ...acceptedEvidence,
    tokenUri: "ipfs://claim-330",
    contentUri: "ipfs://claim-330-image",
    title: "Blue bottle outdoors",
    text: "Proof photo taken outside with a timestamp and the object in frame.",
    imageUrl: "ipfs://claim-330-image",
    rawMetadata: { image: "ipfs://claim-330-image" }
  };

  const acceptedResult = scoreClaimWithEvidence(
    "Take a photo of something blue outdoors",
    "Upload a clear outdoor photo of something blue.",
    claim,
    acceptedEvidence
  );

  const unacceptedResult = scoreClaimWithEvidence(
    "Take a photo of something blue outdoors",
    "Upload a clear outdoor photo of something blue.",
    { ...claim, accepted: false },
    unacceptedEvidence
  );

  assert.ok(acceptedResult.score > unacceptedResult.score);
  assert.match(acceptedResult.reasons.join(" "), /image/i);
  assert.match(acceptedResult.reasons.join(" "), /accepted on-chain/i);
});
