import type { ClaimEvidence, ClaimTuple } from "./types.js";

export type AiEvaluationVerdict = "accept" | "reject" | "needs_review";

export type AiClaimEvaluation = {
  verdict: AiEvaluationVerdict;
  confidence: number;
  reasons: string[];
  model: string;
  visionSummary?: string;
  visionSignals?: string[];
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

function extractCodeBlockJson(rawText: string): string | undefined {
  const fencedMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!fencedMatch?.[1]) {
    return undefined;
  }
  return fencedMatch[1].trim();
}

function parseAiResponseContent(rawText: string): {
  verdict?: AiEvaluationVerdict;
  confidence?: number;
  reasons?: string[];
  visionSummary?: string;
  visionSignals?: string[];
} | undefined {
  const chainOfThoughtScaffold =
    /^(okay, let'?s|let'?s tackle|first,?\s+i need to|the user wants me to|i need to check|i will evaluate)/i;

  const normalizeString = (value: unknown): string | undefined => {
    if (typeof value !== "string") {
      return undefined;
    }
    const trimmed = value.trim().replace(/^["'`]+|["'`]+$/g, "");
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const normalizeStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) {
      return undefined;
    }
    const items = value
      .map((item) => normalizeString(item))
      .filter((item): item is string => typeof item === "string");
    return items.length > 0 ? items.slice(0, 10) : undefined;
  };

  const candidates = [
    rawText,
    extractCodeBlockJson(rawText),
    stripJsonEnvelope(rawText)
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Partial<{
        verdict: AiEvaluationVerdict;
        confidence: number;
        reasons: string[];
        visionSummary: string;
        visionSignals: string[];
        observedText: string;
        visibleText: string;
        ocrText: string;
        observation: string;
        observations: string[];
        visibleSignals: string[];
        observedSignals: string[];
        signals: string[];
      }>;
      return {
        verdict: parsed.verdict,
        confidence: parsed.confidence,
        reasons: parsed.reasons,
        visionSummary:
          normalizeString(parsed.visionSummary) ??
          normalizeString(parsed.observedText) ??
          normalizeString(parsed.visibleText) ??
          normalizeString(parsed.ocrText) ??
          normalizeString(parsed.observation) ??
          normalizeStringArray(parsed.observations)?.join("; "),
        visionSignals:
          normalizeStringArray(parsed.visionSignals) ??
          normalizeStringArray(parsed.visibleSignals) ??
          normalizeStringArray(parsed.observedSignals) ??
          normalizeStringArray(parsed.signals)
      };
    } catch {
      continue;
    }
  }

  const explicitVerdictMatch =
    rawText.match(/\b(?:verdict|decision|result)\b[^a-z]*(accept|reject|needs[_\s-]?review)\b/i) ??
    rawText.match(/^\s*(accept|reject|needs[_\s-]?review)\s*$/im) ??
    rawText.match(/\b(?:claim|submission)\s+(?:is|should be)\s+(accepted|rejected|needs review)\b/i);

  const verdictToken = explicitVerdictMatch?.[1]
    ?.toLowerCase()
    .replace(/\s+/g, "_")
    .replace("accepted", "accept")
    .replace("rejected", "reject")
    .replace("needs-review", "needs_review")
    .replace("needsreview", "needs_review");

  const confidenceMatch = rawText.match(/\bconfidence\b[^0-9]*([01](?:\.\d+)?)/i);
  const reasons = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s>*-]+/, "").trim())
    .filter((line) => /^[-*•]\s+|^reasons?\s*:/i.test(line))
    .map((line) => line.replace(/^reasons?\s*:\s*/i, "").replace(/^[-*•]\s+/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 5);

  if (!verdictToken) {
    return undefined;
  }

  const visionSummary =
    rawText
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s>*-]+/, "").trim())
      .filter((line) => !chainOfThoughtScaffold.test(line))
      .find((line) =>
        /\b(image|photo|picture|note|handwritten|hand written|reads|says|shows|visible|contains|outdoor|username|date|poidh)\b/i.test(
          line
        )
      );

  const visionSignals = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\s>*-]+/, "").trim())
    .filter((line) => !chainOfThoughtScaffold.test(line))
    .filter(
      (line) =>
        /\b(image|photo|picture|note|handwritten|hand written|reads|says|shows|visible|contains|outdoor|username|date|poidh)\b/i.test(
          line
        )
    )
    .slice(0, 4);

  return {
    verdict: parseVerdict(verdictToken),
    confidence: normalizeConfidence(
      confidenceMatch?.[1] ? Number.parseFloat(confidenceMatch[1]) : undefined
    ),
    reasons,
    visionSummary: normalizeString(visionSummary),
    visionSignals: visionSignals.length > 0 ? visionSignals : undefined
  };
}

type OpenRouterMessage = {
  role: "system" | "user";
  content:
    | string
    | Array<
        | {
            type: "text";
            text: string;
          }
        | {
            type: "image_url";
            image_url: { url: string };
          }
      >;
};

type OpenRouterChoiceMessage = {
  content?: string | Array<{ type?: string; text?: string }>;
  reasoning?: string;
  refusal?: string;
};

function readOpenRouterMessageContent(message: OpenRouterChoiceMessage | undefined): string {
  if (!message) {
    return "";
  }
  if (typeof message.content === "string") {
    return message.content.trim();
  }
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }
  return (message.reasoning ?? message.refusal ?? "").trim();
}

async function requestAiEvaluation(
  apiKey: string,
  model: string,
  messages: OpenRouterMessage[]
): Promise<AiClaimEvaluation | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 320,
        messages
      })
    });

    if (!response.ok) {
      const errorText = (await response.text()).trim();
      if (errorText) {
        console.warn(
          `[openrouter] HTTP ${response.status} ${response.statusText} for model ${model}: ${errorText.slice(0, 400)}`
        );
      } else {
        console.warn(`[openrouter] HTTP ${response.status} ${response.statusText} for model ${model}.`);
      }
      return undefined;
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: OpenRouterChoiceMessage;
      }>;
    };
    const rawText = readOpenRouterMessageContent(payload.choices?.[0]?.message);
    if (!rawText) {
      console.warn(`[openrouter] empty response content for model ${model}.`);
      return undefined;
    }

    const parsed = parseAiResponseContent(rawText);
    if (!parsed) {
      console.warn(
        `[openrouter] unable to parse response content for model ${model}: ${rawText.slice(0, 400)}`
      );
      return undefined;
    }

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
      model,
      visionSummary: parsed.visionSummary,
      visionSignals: parsed.visionSignals
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
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

  const sharedSystemMessage: OpenRouterMessage = {
    role: "system",
    content:
      "You evaluate Poidh real-world bounty submissions. Return strict JSON with keys verdict, confidence, reasons, visionSummary, visionSignals. verdict must be one of accept, reject, needs_review. confidence must be 0..1. reasons must be a short array of factual strings. visionSummary must be a short plain-language description of what you actually see in the proof image or proof page, especially any visible text. visionSignals must be a short array of the main visible cues or transcribed words you observed. Reject if evidence does not clearly satisfy the prompt. When image URLs are provided, visually inspect them."
  };

  const sharedPayload = {
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
  };

  const multimodalResult = await requestAiEvaluation(input.apiKey, input.model, [
    sharedSystemMessage,
    {
      role: "user",
      content: [
        {
          type: "text",
          text: JSON.stringify(sharedPayload, null, 2)
        },
        ...imageUrls.map((url) => ({
          type: "image_url" as const,
          image_url: { url }
        }))
      ]
    }
  ]);
  if (multimodalResult) {
    return multimodalResult;
  }

  // Fallback for models/routes that reject multimodal payloads.
  const textOnlyPayload = {
    ...sharedPayload,
    imageUrls
  };

  return requestAiEvaluation(input.apiKey, input.model, [
    sharedSystemMessage,
    {
      role: "user",
      content: JSON.stringify(textOnlyPayload, null, 2)
    }
  ]);
}
