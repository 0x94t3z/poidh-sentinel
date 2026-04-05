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
  enableVision?: boolean;
  inspectLinkedUrls?: boolean;
  maxLinkedUrls?: number;
};

type LinkedContext = {
  url: string;
  contentType: string;
  summary: string;
};

const USER_AGENT = "poidh-sentinel/1.0";

function normalizeUri(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  }
  if (uri.startsWith("ar://")) {
    return uri.replace("ar://", "https://arweave.net/");
  }
  return uri;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractUrls(input: string): string[] {
  const matches = input.match(/\bhttps?:\/\/[^\s<>"')]+/gi) ?? [];
  return matches;
}

function uniqueNormalizedUrls(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of values) {
    const value = normalizeUri(raw).trim();
    if (!value || !isHttpUrl(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function collectEvidenceImageUrls(evidence: ClaimEvidence): string[] {
  const urls = [
    evidence.imageUrl,
    evidence.animationUrl,
    evidence.contentType.startsWith("image/") ? evidence.contentUri : undefined
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return uniqueNormalizedUrls(urls);
}

async function fetchLinkedContext(url: string): Promise<LinkedContext> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: controller.signal
    });

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!response.ok) {
      return {
        url,
        contentType,
        summary: `Fetch failed: ${response.status} ${response.statusText}`
      };
    }

    if (contentType.startsWith("image/") || contentType.startsWith("video/")) {
      return {
        url,
        contentType,
        summary: `Resolved media URL (${contentType || "unknown media type"}).`
      };
    }

    if (
      contentType &&
      !contentType.includes("text/") &&
      !contentType.includes("json") &&
      !contentType.includes("html")
    ) {
      return {
        url,
        contentType,
        summary: `Skipped non-text content type: ${contentType}`
      };
    }

    const body = await response.text();
    const text = (contentType.includes("html") ? stripHtml(body) : body)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1_600);

    return {
      url,
      contentType,
      summary: text || "No readable text extracted."
    };
  } catch {
    return {
      url,
      contentType: "",
      summary: "Fetch failed or timed out."
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLinkedContexts(urls: string[], maxLinkedUrls: number): Promise<LinkedContext[]> {
  const limited = urls.slice(0, Math.max(0, maxLinkedUrls));
  return Promise.all(limited.map((url) => fetchLinkedContext(url)));
}

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
  const enableVision = input.enableVision ?? true;
  const inspectLinkedUrls = input.inspectLinkedUrls ?? true;
  const maxLinkedUrls = Math.max(0, Math.floor(input.maxLinkedUrls ?? 2));

  const imageUrls = enableVision ? collectEvidenceImageUrls(input.evidence) : [];
  const linkedUrls = inspectLinkedUrls
    ? uniqueNormalizedUrls(
        extractUrls(`${input.claim.description} ${input.evidence.text} ${input.evidence.title ?? ""}`)
      )
    : [];
  const linkedContexts =
    inspectLinkedUrls && linkedUrls.length > 0
      ? await fetchLinkedContexts(linkedUrls, maxLinkedUrls)
      : [];

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
        max_tokens: 320,
        messages: [
          {
            role: "system",
            content:
              "You evaluate Poidh real-world bounty submissions. Return strict JSON with keys verdict, confidence, reasons. verdict must be one of accept, reject, needs_review. confidence must be 0..1. reasons must be a short array of factual strings. Reject if evidence does not clearly satisfy the prompt. When image URLs are provided, visually inspect them."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: JSON.stringify(
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
                    },
                    linkedContext: linkedContexts,
                    instructions: {
                      imageCount: imageUrls.length,
                      linkedUrlCount: linkedContexts.length
                    }
                  },
                  null,
                  2
                )
              },
              ...imageUrls.map((url) => ({
                type: "image_url",
                image_url: { url }
              }))
            ]
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
