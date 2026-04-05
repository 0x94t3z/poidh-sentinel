import assert from "node:assert/strict";
import test from "node:test";
import { validateRealWorldBounty } from "../src/runtime/bountyValidation.js";
import {
  evaluateClaims,
  getStrictTaskEvidenceFailures,
  rankEvaluations,
  scoreClaimWithEvidence
} from "../src/core/evaluate.js";
import type { ClaimEvaluation, ClaimEvidence, ClaimTuple } from "../src/core/types.js";

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

test("breaks score ties by favoring earlier submissions", () => {
  const firstClaim: ClaimTuple = {
    id: 336n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 82n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Blue object proof",
    description: "Outdoor image proof",
    createdAt: 1000n,
    accepted: false
  };

  const laterClaim: ClaimTuple = {
    ...firstClaim,
    id: 337n,
    createdAt: 2000n
  };

  const firstEvaluation: ClaimEvaluation = {
    claim: firstClaim,
    score: 27,
    reasons: ["Proof resolves to an image."],
    evidence: {
      tokenUri: "ipfs://claim-336",
      contentUri: "ipfs://image-336",
      contentType: "image/jpeg",
      text: "Outdoor proof image",
      imageUrl: "ipfs://image-336"
    }
  };

  const laterEvaluation: ClaimEvaluation = {
    claim: laterClaim,
    score: 27,
    reasons: ["Proof resolves to an image."],
    evidence: {
      tokenUri: "ipfs://claim-337",
      contentUri: "ipfs://image-337",
      contentType: "image/jpeg",
      text: "Outdoor proof image",
      imageUrl: "ipfs://image-337"
    }
  };

  const ranked = rankEvaluations([laterEvaluation, firstEvaluation]);
  assert.equal(ranked[0]?.claim.id, 336n);
});

test("deprioritizes later duplicate evidence submissions", () => {
  const firstClaim: ClaimTuple = {
    id: 336n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 82n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Blue object proof",
    description: "Outdoor image proof",
    createdAt: 1000n,
    accepted: false
  };

  const duplicateClaim: ClaimTuple = {
    ...firstClaim,
    id: 337n,
    createdAt: 2000n
  };

  const sharedEvidence: ClaimEvidence = {
    tokenUri: "ipfs://same-proof",
    contentUri: "ipfs://same-image",
    contentType: "image/jpeg",
    title: "Blue object outdoors",
    text: "Outdoor proof image with timestamp",
    imageUrl: "ipfs://same-image"
  };

  const firstEvaluation: ClaimEvaluation = {
    claim: firstClaim,
    score: 27,
    reasons: ["Proof resolves to an image."],
    evidence: sharedEvidence
  };

  const duplicateEvaluation: ClaimEvaluation = {
    claim: duplicateClaim,
    score: 27,
    reasons: ["Proof resolves to an image."],
    evidence: {
      ...sharedEvidence
    }
  };

  const ranked = rankEvaluations([duplicateEvaluation, firstEvaluation]);
  assert.equal(ranked[0]?.claim.id, 336n);
  const duplicateResult = ranked.find((item) => item.claim.id === 337n);
  assert.ok(duplicateResult);
  assert.ok(duplicateResult!.score < firstEvaluation.score);
  assert.match(duplicateResult!.reasons.join(" "), /duplicate evidence/i);
});

test("rejects claims that fail strict handwritten/date/username/poidh/outdoor checks", () => {
  const claim: ClaimTuple = {
    id: 401n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 90n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Submission",
    description: "Here is my proof.",
    createdAt: 123456n,
    accepted: false
  };

  const evidence: ClaimEvidence = {
    tokenUri: "ipfs://claim-401",
    contentUri: "ipfs://random-photo",
    contentType: "image/jpeg",
    title: "Random photo",
    text: "Outdoor proof image.",
    imageUrl: "ipfs://random-photo"
  };

  const result = scoreClaimWithEvidence(
    "Photo of a handwritten note with today’s date",
    "Upload a clear outdoor photo of a handwritten note that says today’s full date, your username, and the word poidh.",
    claim,
    evidence
  );

  const strictFailures = getStrictTaskEvidenceFailures(
    "Photo of a handwritten note with today’s date",
    "Upload a clear outdoor photo of a handwritten note that says today’s full date, your username, and the word poidh.",
    claim,
    evidence
  );

  assert.ok(strictFailures.length > 0);
  assert.notEqual(result.score, -1);
  assert.match(result.reasons.join(" "), /strict deterministic signal check flagged/i);
  assert.match(result.reasons.join(" "), /handwritten note evidence/i);
});

test("accepts claims that provide handwritten, date, username, poidh, and outdoor evidence signals", () => {
  const claim: ClaimTuple = {
    id: 402n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 90n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Handwritten note outdoors",
    description: "Note shows the date and username with poidh written clearly outside.",
    createdAt: 123457n,
    accepted: false
  };

  const evidence: ClaimEvidence = {
    tokenUri: "ipfs://claim-402",
    contentUri: "ipfs://note-photo",
    contentType: "image/jpeg",
    title: "Outdoor handwritten note",
    text: "Taken outside. Handwritten note says 2026-04-05, @0x94t3z, and poidh in the frame.",
    imageUrl: "ipfs://note-photo"
  };

  const result = scoreClaimWithEvidence(
    "Photo of a handwritten note with today’s date",
    "Upload a clear outdoor photo of a handwritten note that says today’s full date, your username, and the word poidh.",
    claim,
    evidence
  );

  assert.ok(result.score >= 0);
  assert.doesNotMatch(result.reasons.join(" "), /strict deterministic signal check flagged/i);
});

test("deterministic mode rejects claims that fail strict eligibility checks", async () => {
  const claim: ClaimTuple = {
    id: 500n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 91n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Submission",
    description: "A random proof.",
    createdAt: 123500n,
    accepted: false
  };

  const tokenUris = new Map<bigint, string>([
    [claim.id, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="]
  ]);

  const evaluations = await evaluateClaims(
    "Photo of a handwritten note with today’s date",
    "Upload a clear outdoor photo of a handwritten note that says today’s full date, your username, and the word poidh.",
    [claim],
    tokenUris,
    { mode: "deterministic" }
  );

  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.score, -1);
  assert.match(evaluations[0]?.reasons.join(" ") ?? "", /deterministic strict evidence gate/i);
});

test("deterministic mode keeps already accepted claims valid", async () => {
  const acceptedClaim: ClaimTuple = {
    id: 501n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 91n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Submission",
    description: "A random proof.",
    createdAt: 123501n,
    accepted: true
  };

  const tokenUris = new Map<bigint, string>([
    [acceptedClaim.id, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="]
  ]);

  const evaluations = await evaluateClaims(
    "Photo of a handwritten note with today’s date",
    "Upload a clear outdoor photo of a handwritten note that says today’s full date, your username, and the word poidh.",
    [acceptedClaim],
    tokenUris,
    { mode: "deterministic" }
  );

  assert.equal(evaluations.length, 1);
  assert.ok((evaluations[0]?.score ?? -1) >= 0);
  assert.match(
    evaluations[0]?.reasons.join(" ") ?? "",
    /treated as final-valid regardless of strict signal mismatches/i
  );
});

test("ai_hybrid falls back to deterministic scoring when AI is unavailable", async () => {
  const claim: ClaimTuple = {
    id: 502n,
    issuer: "0x1111111111111111111111111111111111111111",
    bountyId: 92n,
    bountyIssuer: "0x2222222222222222222222222222222222222222",
    name: "Handwritten note outdoors",
    description: "A real photo with a note and a date.",
    createdAt: 123502n,
    accepted: false
  };

  const tokenUris = new Map<bigint, string>([
    [claim.id, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII="]
  ]);

  const evaluations = await evaluateClaims(
    "Photo of a handwritten note with today’s date",
    "Upload a clear outdoor photo of a handwritten note that says today’s full date, your username, and the word poidh.",
    [claim],
    tokenUris,
    { mode: "ai_hybrid", aiApiKey: "" }
  );

  assert.equal(evaluations.length, 1);
  assert.ok((evaluations[0]?.score ?? -1) >= 0);
  assert.match(
    evaluations[0]?.reasons.join(" ") ?? "",
    /AI evaluation skipped because OPENROUTER_API_KEY is not configured; used deterministic scoring\./
  );
});
