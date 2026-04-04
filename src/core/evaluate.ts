import type { ClaimEvaluation, ClaimEvidence, ClaimTuple } from "./types.js";
import { resolveClaimEvidence } from "./uri.js";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "at",
  "by",
  "from",
  "this",
  "that",
  "is",
  "it",
  "be",
  "as",
  "are",
  "was",
  "were",
  "will",
  "we",
  "you",
  "they",
  "their",
  "your"
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function overlapScore(a: string, b: string): { score: number; matches: string[] } {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  const matches = [...left].filter((token) => right.has(token));
  const denom = Math.max(left.size, right.size, 1);
  return { score: matches.length / denom, matches };
}

function looksLikeRealWorldProof(evidence: ClaimEvidence): boolean {
  const haystack = [
    evidence.contentType,
    evidence.contentUri,
    evidence.text,
    evidence.title ?? "",
    JSON.stringify(evidence.rawMetadata ?? {})
  ]
    .join(" ")
    .toLowerCase();

  return /photo|image|video|camera|selfie|proof|irl|street|outside|holding|seen|timestamp/.test(
    haystack
  );
}

export async function evaluateClaim(
  bountyName: string,
  bountyDescription: string,
  claim: ClaimTuple,
  tokenUri: string
): Promise<ClaimEvaluation> {
  const evidence = await resolveClaimEvidence(tokenUri);
  const reasons: string[] = [];
  let score = 0;

  const nameOverlap = overlapScore(bountyName, claim.name);
  const descriptionOverlap = overlapScore(
    `${bountyName} ${bountyDescription}`,
    `${claim.name} ${claim.description} ${evidence.title ?? ""} ${evidence.text}`
  );

  const namePoints = Math.round(nameOverlap.score * 25);
  const descriptionPoints = Math.round(descriptionOverlap.score * 45);
  score += namePoints + descriptionPoints;

  if (namePoints > 0) {
    reasons.push(`Name overlap matched ${nameOverlap.matches.join(", ") || "task keywords"}.`);
  }
  if (descriptionPoints > 0) {
    reasons.push(
      `Description/evidence overlap matched ${descriptionOverlap.matches.join(", ") || "task keywords"}.`
    );
  }

  if (evidence.contentType.startsWith("image/")) {
    score += 12;
    reasons.push("Proof resolves to an image, which is strong evidence for a real-world task.");
  } else if (evidence.contentType.startsWith("video/")) {
    score += 15;
    reasons.push("Proof resolves to a video, which is strong evidence for a real-world task.");
  } else if (evidence.contentType.includes("html")) {
    score += 5;
    reasons.push("Proof resolves to a webpage that can be inspected directly.");
  } else if (evidence.text.length > 200) {
    score += 4;
    reasons.push("Claim includes a substantial explanation of the submission.");
  }

  if (evidence.imageUrl) {
    score += 5;
    reasons.push("Metadata includes an image URL.");
  }
  if (evidence.animationUrl) {
    score += 7;
    reasons.push("Metadata includes an animation URL or video URL.");
  }
  if (looksLikeRealWorldProof(evidence)) {
    score += 10;
    reasons.push("The evidence text looks like a real-world proof artifact.");
  }

  if (claim.accepted) {
    score += 50;
    reasons.push("Claim is already accepted on-chain.");
  }

  return {
    claim,
    score,
    reasons,
    evidence
  };
}

export async function evaluateClaims(
  bountyName: string,
  bountyDescription: string,
  claims: ClaimTuple[],
  tokenUris: Map<bigint, string>
): Promise<ClaimEvaluation[]> {
  const evaluations = await Promise.all(
    claims.map(async (claim) => {
      const tokenUri = tokenUris.get(claim.id);
      if (!tokenUri) {
        return {
          claim,
          score: -1,
          reasons: ["No token URI was available for this claim."],
          evidence: {
            tokenUri: "",
            contentUri: "",
            contentType: "",
            text: ""
          } satisfies ClaimEvidence
        };
      }
      try {
        return await evaluateClaim(bountyName, bountyDescription, claim, tokenUri);
      } catch (error) {
        return {
          claim,
          score: -1,
          reasons: [
            error instanceof Error ? error.message : "Failed to evaluate claim evidence."
          ],
          evidence: {
            tokenUri,
            contentUri: tokenUri,
            contentType: "",
            text: ""
          } satisfies ClaimEvidence
        };
      }
    })
  );

  return evaluations.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return Number(right.claim.createdAt - left.claim.createdAt);
  });
}
