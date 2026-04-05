import type { ClaimEvaluation, ClaimEvidence, ClaimTuple } from "./types.js";
import { evaluateClaimWithAi, type AiClaimEvaluation } from "./aiEvaluation.js";
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
const DUPLICATE_EVIDENCE_PENALTY = 20;
const STRICT_SIGNAL_PENALTY = 20;

type BountyEvidenceRequirements = {
  requiresVisualProof: boolean;
  requiresHandwrittenNote: boolean;
  requiresDateSignal: boolean;
  requiresUsernameSignal: boolean;
  requiresPoidhSignal: boolean;
  requiresOutdoorSignal: boolean;
};

export type EvaluationMode = "deterministic" | "ai_hybrid" | "ai_required";

export type EvaluateClaimsOptions = {
  mode?: EvaluationMode;
  aiApiKey?: string;
  aiModel?: string;
  aiMinConfidence?: number;
  aiEnableVision?: boolean;
  aiInspectLinkedUrls?: boolean;
  aiMaxLinkedUrls?: number;
};

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

function normalizeCompactText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

function deriveBountyEvidenceRequirements(
  bountyName: string,
  bountyDescription: string
): BountyEvidenceRequirements {
  const prompt = `${bountyName} ${bountyDescription}`.toLowerCase();
  return {
    requiresVisualProof: /photo|image|picture|video|camera|selfie/.test(prompt),
    requiresHandwrittenNote: /\bhandwritten\b|\bhand written\b|\bnote\b|\bpaper\b/.test(prompt),
    requiresDateSignal: /\bdate\b|\btoday'?s date\b|\bfull date\b/.test(prompt),
    requiresUsernameSignal: /\busername\b|\buser name\b/.test(prompt),
    requiresPoidhSignal: /\bpoidh\b/.test(prompt),
    requiresOutdoorSignal: /\boutdoor\b|\boutdoors\b|\boutside\b|\bstreet\b|\bpark\b/.test(prompt)
  };
}

function buildEvidenceHaystack(claim: ClaimTuple, evidence: ClaimEvidence): string {
  return [
    claim.name,
    claim.description,
    evidence.title ?? "",
    evidence.text,
    evidence.ocrText ?? "",
    evidence.contentType,
    evidence.contentUri,
    evidence.imageUrl ?? "",
    evidence.animationUrl ?? "",
    JSON.stringify(evidence.rawMetadata ?? {})
  ]
    .join(" ")
    .toLowerCase();
}

function validateEvidenceAgainstTask(
  requirements: BountyEvidenceRequirements,
  claim: ClaimTuple,
  evidence: ClaimEvidence
): string[] {
  const failures: string[] = [];
  const haystack = buildEvidenceHaystack(claim, evidence);
  const hasNaturalFullDateSignal =
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[\s,/-]*\d{1,2}(?:st|nd|rd|th)?[\s,/-]*\d{4}\b/i.test(
      haystack
    ) ||
    /\b\d{1,2}(?:st|nd|rd|th)?[\s,/-]*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b[\s,/-]*\d{4}\b/i.test(
      haystack
    );
  const hasVisualProof =
    evidence.contentType.startsWith("image/") ||
    evidence.contentType.startsWith("video/") ||
    Boolean(evidence.imageUrl) ||
    Boolean(evidence.animationUrl);

  if (requirements.requiresVisualProof && !hasVisualProof) {
    failures.push("missing image or video proof");
  }

  if (
    requirements.requiresHandwrittenNote &&
    !/\bhandwritten\b|\bhand written\b|\bnote\b|\bpaper\b/.test(haystack)
  ) {
    failures.push("missing clear handwritten note evidence");
  }

  if (
    requirements.requiresDateSignal &&
    !(
      /\bdate\b|\btoday'?s date\b|\bfull date\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(
        haystack
      ) || hasNaturalFullDateSignal
    )
  ) {
    failures.push("missing clear date signal");
  }

  if (
    requirements.requiresUsernameSignal &&
    !/\busername\b|\buser name\b|@\w+/.test(haystack)
  ) {
    failures.push("missing clear username signal");
  }

  if (requirements.requiresPoidhSignal && !/\bpoidh\b/.test(haystack)) {
    failures.push("missing clear poidh signal");
  }

  if (
    requirements.requiresOutdoorSignal &&
    !/\boutdoor\b|\boutdoors\b|\boutside\b|\bstreet\b|\bpark\b|\broad\b|\bsky\b|\bsunlight\b|\bgrass\b|\bfield\b|\bgarden\b|\btrees?\b|\bplant\b/.test(
      haystack
    )
  ) {
    failures.push("missing clear outdoor signal");
  }

  return failures;
}

export function getStrictTaskEvidenceFailures(
  bountyName: string,
  bountyDescription: string,
  claim: ClaimTuple,
  evidence: ClaimEvidence
): string[] {
  const requirements = deriveBountyEvidenceRequirements(bountyName, bountyDescription);
  return validateEvidenceAgainstTask(requirements, claim, evidence);
}

function aiObservationText(aiEvaluation: AiClaimEvaluation): string {
  const noise = /(bounty title|bounty prompt|prompt says|the user wants me|let'?s tackle|first,?\s*i need to|i need to check|requirements?:)/i;
  const chunks = [
    aiEvaluation.visionSummary,
    ...(aiEvaluation.visionSignals ?? []),
    ...aiEvaluation.reasons
  ]
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .filter((item) => !noise.test(item));
  return chunks.join(" ").toLowerCase();
}

function aiHasSignalForFailure(failure: string, observed: string): boolean {
  if (failure.includes("date signal")) {
    return /\bdate\b|\btoday\b|\b\d{4}\b|\b\d{1,2}(st|nd|rd|th)?\b|\bjan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec\b/i.test(
      observed
    );
  }
  if (failure.includes("username signal")) {
    return /@\w+|\busername\b|\buser\s*name\b/i.test(observed);
  }
  if (failure.includes("outdoor signal")) {
    return /\boutdoor|outside|grass|sky|park|street|sunlight|field|road\b/i.test(observed);
  }
  if (failure.includes("handwritten note evidence")) {
    return /\bhandwritten|hand written|note|paper\b/i.test(observed);
  }
  if (failure.includes("poidh signal")) {
    return /\bpoidh\b/i.test(observed);
  }
  if (failure.includes("image or video proof")) {
    return /\bimage|photo|picture|video|frame|screenshot\b/i.test(observed);
  }
  return false;
}

function aiProvidesConcreteEvidenceForStrictFailures(
  aiEvaluation: AiClaimEvaluation,
  strictFailures: string[]
): boolean {
  if (strictFailures.length === 0) {
    return true;
  }
  const observed = aiObservationText(aiEvaluation);
  if (!observed) {
    return false;
  }
  return strictFailures.every((failure) => aiHasSignalForFailure(failure, observed));
}

function evidenceFingerprint(evidence: ClaimEvidence): string | undefined {
  const mediaRef = (
    evidence.imageUrl ||
    evidence.animationUrl ||
    evidence.contentUri ||
    ""
  )
    .toLowerCase()
    .trim();
  const textRef = normalizeCompactText(evidence.text).slice(0, 280);
  const titleRef = normalizeCompactText(evidence.title ?? "");

  if (!mediaRef && !textRef && !titleRef) {
    return undefined;
  }

  return [mediaRef, evidence.contentType.toLowerCase().trim(), titleRef, textRef].join("|");
}

export function rankEvaluations(evaluations: ClaimEvaluation[]): ClaimEvaluation[] {
  const byEvidence = new Map<string, ClaimEvaluation[]>();

  for (const evaluation of evaluations) {
    if (evaluation.score < 0) {
      continue;
    }
    const fingerprint = evidenceFingerprint(evaluation.evidence);
    if (!fingerprint) {
      continue;
    }
    const group = byEvidence.get(fingerprint) ?? [];
    group.push(evaluation);
    byEvidence.set(fingerprint, group);
  }

  for (const group of byEvidence.values()) {
    if (group.length < 2) {
      continue;
    }

    group.sort((left, right) => {
      if (left.claim.createdAt !== right.claim.createdAt) {
        return left.claim.createdAt < right.claim.createdAt ? -1 : 1;
      }
      if (left.claim.id !== right.claim.id) {
        return left.claim.id < right.claim.id ? -1 : 1;
      }
      return 0;
    });

    const originalClaim = group[0]!;
    for (const duplicate of group.slice(1)) {
      duplicate.score -= DUPLICATE_EVIDENCE_PENALTY;
      duplicate.reasons.push(
        `Duplicate evidence matched earlier claim ${originalClaim.claim.id.toString()}; later copies are deprioritized.`
      );
    }
  }

  return evaluations.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (left.claim.createdAt !== right.claim.createdAt) {
      return left.claim.createdAt < right.claim.createdAt ? -1 : 1;
    }
    if (left.claim.id !== right.claim.id) {
      return left.claim.id < right.claim.id ? -1 : 1;
    }
    return 0;
  });
}

export function scoreClaimWithEvidence(
  bountyName: string,
  bountyDescription: string,
  claim: ClaimTuple,
  evidence: ClaimEvidence
): ClaimEvaluation {
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
  if (evidence.ocrText && evidence.ocrText.trim().length > 0) {
    score += 6;
    reasons.push("Local OCR extracted readable text from the image proof.");
  }

  if (claim.accepted) {
    score += 50;
    reasons.push("Claim is already accepted on-chain.");
  }

  const strictFailures = getStrictTaskEvidenceFailures(bountyName, bountyDescription, claim, evidence);
  if (strictFailures.length > 0) {
    score -= STRICT_SIGNAL_PENALTY;
    reasons.push(
      `Strict deterministic signal check flagged: ${strictFailures.join(", ")}.`
    );
  }

  return {
    claim,
    score,
    reasons,
    evidence
  };
}

export async function evaluateClaim(
  bountyName: string,
  bountyDescription: string,
  claim: ClaimTuple,
  tokenUri: string
): Promise<ClaimEvaluation> {
  const evidence = await resolveClaimEvidence(tokenUri);
  return scoreClaimWithEvidence(bountyName, bountyDescription, claim, evidence);
}

export async function evaluateClaims(
  bountyName: string,
  bountyDescription: string,
  claims: ClaimTuple[],
  tokenUris: Map<bigint, string>,
  options: EvaluateClaimsOptions = {}
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

  const mode = options.mode ?? "deterministic";
  const aiEnabled = mode === "ai_hybrid" || mode === "ai_required";
  const aiApiKey = options.aiApiKey?.trim() ?? "";
  const aiModel = options.aiModel?.trim() || "openai/gpt-oss-120b:free";
  const aiMinConfidence = Math.max(0, Math.min(1, options.aiMinConfidence ?? 0.55));
  const aiEnableVision = options.aiEnableVision ?? true;
  const aiInspectLinkedUrls = options.aiInspectLinkedUrls ?? true;
  const aiMaxLinkedUrls = Math.max(0, Math.floor(options.aiMaxLinkedUrls ?? 2));
  const aiRequired = mode === "ai_required";
  const strictFailuresByClaimId = new Map<bigint, string[]>();

  for (const evaluation of evaluations) {
    if (evaluation.score < 0) {
      continue;
    }
    if (evaluation.claim.accepted) {
      evaluation.reasons.push(
        "Claim is already accepted on-chain, so it is treated as final-valid regardless of strict signal mismatches."
      );
      continue;
    }
    const strictFailures = getStrictTaskEvidenceFailures(
      bountyName,
      bountyDescription,
      evaluation.claim,
      evaluation.evidence
    );
    if (strictFailures.length > 0) {
      strictFailuresByClaimId.set(evaluation.claim.id, strictFailures);
      if (
        !evaluation.reasons.some((reason) =>
          reason.startsWith("Strict deterministic signal check flagged:")
        )
      ) {
        evaluation.reasons.push(
          `Strict deterministic signal check flagged: ${strictFailures.join(", ")}.`
        );
      }
    }
  }

  if (mode === "deterministic") {
    for (const evaluation of evaluations) {
      if (evaluation.score < 0) {
        continue;
      }
      if (evaluation.claim.accepted) {
        continue;
      }
      if (strictFailuresByClaimId.has(evaluation.claim.id)) {
        evaluation.score = -1;
        evaluation.reasons.push("Claim rejected by deterministic strict evidence gate.");
      }
    }
    return rankEvaluations(evaluations);
  }

  if (aiEnabled) {
    await Promise.all(
      evaluations.map(async (evaluation) => {
        if (evaluation.score < 0) {
          return;
        }
        if (evaluation.claim.accepted) {
          return;
        }
        const hasStrictSignalMismatch = strictFailuresByClaimId.has(evaluation.claim.id);

        if (!aiApiKey) {
          if (aiRequired) {
            evaluation.score = -1;
            evaluation.reasons.push(
              "Claim rejected because AI evidence verification is required but OPENROUTER_API_KEY is not configured."
            );
            return;
          }
          evaluation.reasons.push(
            "AI evaluation skipped because OPENROUTER_API_KEY is not configured; used deterministic scoring."
          );
          return;
        }

        const aiEvaluation: AiClaimEvaluation | undefined = await evaluateClaimWithAi({
          bountyTitle: bountyName,
          bountyPrompt: bountyDescription,
          claim: evaluation.claim,
          evidence: evaluation.evidence,
          model: aiModel,
          apiKey: aiApiKey,
          enableVision: aiEnableVision,
          inspectLinkedUrls: aiInspectLinkedUrls,
          maxLinkedUrls: aiMaxLinkedUrls
        });

        if (!aiEvaluation) {
          if (aiRequired) {
            evaluation.score = -1;
            evaluation.reasons.push(
              "Claim rejected because AI evidence verification is required but the AI evaluator was unavailable."
            );
            return;
          }
          evaluation.reasons.push("AI evaluator unavailable; used deterministic scoring.");
          return;
        }

        evaluation.reasons.push(
          `AI verdict (${aiEvaluation.model}): ${aiEvaluation.verdict} (${aiEvaluation.confidence.toFixed(2)} confidence).`
        );
        if (aiEvaluation.visionSummary) {
          evaluation.visionSummary = aiEvaluation.visionSummary;
        }
        if (aiEvaluation.visionSignals && aiEvaluation.visionSignals.length > 0) {
          evaluation.visionSignals = aiEvaluation.visionSignals;
        }
        if (aiEvaluation.reasons.length > 0) {
          evaluation.reasons.push(...aiEvaluation.reasons.map((reason) => `AI: ${reason}`));
        }

        if (hasStrictSignalMismatch) {
          const strictFailures = strictFailuresByClaimId.get(evaluation.claim.id) ?? [];
          const aiHasConcreteEvidence = aiProvidesConcreteEvidenceForStrictFailures(
            aiEvaluation,
            strictFailures
          );
          if (!aiHasConcreteEvidence) {
            if (aiRequired) {
              evaluation.score = -1;
              evaluation.reasons.push(
                "Claim rejected because AI response did not provide concrete observed evidence for strict missing signals."
              );
              return;
            }
            evaluation.reasons.push(
              "AI verdict ignored because it lacked concrete observed evidence for strict missing signals; used deterministic scoring."
            );
            return;
          }
        }

        if (aiEvaluation.verdict === "reject" || aiEvaluation.confidence < aiMinConfidence) {
          evaluation.score = -1;
          evaluation.reasons.push("Claim rejected by AI evaluation gate.");
          return;
        }

        if (aiEvaluation.verdict === "needs_review") {
          evaluation.score = -1;
          evaluation.reasons.push("Claim rejected because AI marked it as needs_review.");
          return;
        }

        evaluation.score += 8;
        evaluation.reasons.push("AI evaluation confirmed this claim as valid for the task.");
        if (hasStrictSignalMismatch) {
          evaluation.reasons.push(
            "AI accepted this claim despite strict deterministic signal mismatch."
          );
        }
      })
    );
  }

  return rankEvaluations(evaluations);
}
