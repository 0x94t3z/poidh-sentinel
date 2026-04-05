import type { ClaimEvidence, ClaimTuple } from "./types.js";

export type AiEvaluationVerdict = "accept" | "reject" | "needs_review";

export type AiClaimEvaluation = {
  verdict: AiEvaluationVerdict;
  confidence: number;
  reasons: string[];
  model: string;
};

type AiEvaluationInput = {
  bountyTitle: string;
  bountyPrompt: string;
  claim: ClaimTuple;
  evidence: ClaimEvidence;
  model: string;
  apiKey: string;
};

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function parseVerdict(value: unknown): AiEvaluationVerdict {
  if (value === "accept" || value === "reject" || value === "needs_review") {
    return value;
  }
  return "needs_review";
}

function stripJsonEnvelope(rawText: string): string {
  const trimmed = rawText.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) {
    return trimmed;
  }
  return trimmed.slice(start, end + 1);
}

export async function evaluateClaimWithAi(input: AiEvaluationInput): Promise<AiClaimEvaluation | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        max_tokens: 240,
        messages: [
          {
            role: "system",
            content:
              "You evaluate Poidh real-world bounty submissions. Return strict JSON with keys verdict, confidence, reasons. verdict must be one of accept, reject, needs_review. confidence must be 0..1. reasons must be a short array of factual strings. Reject if evidence does not clearly satisfy the prompt."
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                bounty: {
                  title: input.bountyTitle,
                  prompt: input.bountyPrompt
                },
                claim: {
                  id: input.claim.id.toString(),
                  name: input.claim.name,
                  description: input.claim.description
                },
                evidence: {
                  tokenUri: input.evidence.tokenUri,
                  contentUri: input.evidence.contentUri,
                  contentType: input.evidence.contentType,
                  title: input.evidence.title,
                  text: input.evidence.text,
                  imageUrl: input.evidence.imageUrl,
                  animationUrl: input.evidence.animationUrl,
                  metadata: input.evidence.rawMetadata
                }
              },
              null,
              2
            )
          }
        ]
      })
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    const rawText = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawText) {
      return undefined;
    }

    const parsed = JSON.parse(stripJsonEnvelope(rawText)) as Partial<{
      verdict: AiEvaluationVerdict;
      confidence: number;
      reasons: string[];
    }>;

    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : [];

    return {
      verdict: parseVerdict(parsed.verdict),
      confidence: normalizeConfidence(parsed.confidence),
      reasons,
      model: input.model
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
