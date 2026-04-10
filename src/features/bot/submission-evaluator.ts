import "server-only";
import { detectAiImage } from "@/features/bot/agent";
import sharp from "sharp";

const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "stepfun/step-3.5-flash:free",
  "arcee-ai/trinity-mini:free",
];

export interface ClaimData {
  id: string;
  issuer: string;
  name: string;
  description: string;
  uri: string;
}

// Format a unix timestamp as a human-readable date string like "6th April 2026"
function formatBountyDate(unixSeconds: bigint | number | undefined): string | null {
  if (!unixSeconds) return null;
  try {
    const ms = typeof unixSeconds === "bigint" ? Number(unixSeconds) * 1000 : Number(unixSeconds) * 1000;
    const d = new Date(ms);
    const day = d.getUTCDate();
    const suffix = day === 1 || day === 21 || day === 31 ? "st"
      : day === 2 || day === 22 ? "nd"
      : day === 3 || day === 23 ? "rd" : "th";
    const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
    const year = d.getUTCFullYear();
    return `${day}${suffix} ${month} ${year}`;
  } catch {
    return null;
  }
}

export interface EvaluationResult {
  claimId: string;
  issuer?: string;      // EVM wallet address of the submitter
  score: number;        // 0-100
  valid: boolean;
  reasoning: string;
  deterministicScore?: number;  // pre-filter score for transparency
  openaiVisionCost?: { promptTokens: number; completionTokens: number; estimatedCostUsd: number };
}

// ---------------------------------------------------------------------------
// LLM helpers
// ---------------------------------------------------------------------------

async function callLLM(prompt: string): Promise<string> {
  const messages = [{ role: "user", content: prompt }];

  // Try Groq text models first (same key as vision, free tier, fast)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens: 300, temperature: 0.3, response_format: { type: "json_object" } }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[evaluator] groq text responded`);
          return content;
        }
      } else {
        console.warn(`[evaluator] groq text returned ${res.status}`);
      }
    } catch (err) {
      console.warn(`[evaluator] groq text failed:`, err);
    }
  }

  // Try Cerebras (fast + free)
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (cerebrasKey) {
    try {
      const res = await fetch(CEREBRAS_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${cerebrasKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b", messages, max_tokens: 300, temperature: 0.3 }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      }
    } catch {
      // fall through to OpenRouter
    }
  }

  return callOpenRouter(prompt, 0);
}

async function callOpenRouter(prompt: string, modelIndex = 0): Promise<string> {
  const model = OPENROUTER_MODELS[modelIndex] ?? OPENROUTER_MODELS[0];
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("No LLM API key configured");

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.BOT_APP_URL ?? `https://${process.env.BOT_USERNAME ?? "poidh-sentinel"}.neynar.app`,
      "X-Title": process.env.BOT_USERNAME ?? "poidh-sentinel",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    if (modelIndex < OPENROUTER_MODELS.length - 1) return callOpenRouter(prompt, modelIndex + 1);
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content && modelIndex < OPENROUTER_MODELS.length - 1) return callOpenRouter(prompt, modelIndex + 1);
  return content ?? "";
}

// ---------------------------------------------------------------------------
// Deterministic pre-scorer
// ---------------------------------------------------------------------------
// Runs before any AI call. Fast, fully auditable, no API cost.
// Computes token overlap between bounty requirements and submission text,
// then applies penalties for suspicious signals.
//
// Returns a 0-100 score. Claims scoring < DETERMINISTIC_REJECT_THRESHOLD
// are rejected immediately without calling vision AI or the LLM evaluator.

const DETERMINISTIC_REJECT_THRESHOLD = 15;

// Phrases that indicate submission is off-topic, spam, or gaming the system
const PENALTY_SIGNALS = [
  "test submission",
  "just testing",
  "placeholder",
  "lorem ipsum",
  "example submission",
  "this is a test",
  "n/a",
  "tbd",
  "coming soon",
  "will submit later",
];

// Phrases that indicate digital-only submission (no real-world proof)
const DIGITAL_ONLY_SUBMISSION_SIGNALS = [
  "nft link",
  "my twitter",
  "my tweet",
  "screenshot of",
  "discord message",
  "retweet proof",
  "wallet address",
];

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2), // skip stopwords / short tokens
  );
}

export function deterministicScore(
  bountyName: string,
  bountyDescription: string,
  claim: ClaimData,
): number {
  const bountyTokens = tokenize(`${bountyName} ${bountyDescription}`);
  const claimTokens = tokenize(`${claim.name} ${claim.description}`);

  if (bountyTokens.size === 0) return 50; // can't score, don't penalize

  // Jaccard-style overlap score (0-100)
  let overlap = 0;
  for (const t of claimTokens) {
    if (bountyTokens.has(t)) overlap++;
  }
  const overlapScore = Math.min(100, Math.round((overlap / bountyTokens.size) * 100 * 3));
  // ×3 multiplier: even partial overlap should push past the threshold

  // Penalty for spam / off-topic signals
  const combined = `${claim.name} ${claim.description}`.toLowerCase();
  let penalty = 0;
  for (const signal of PENALTY_SIGNALS) {
    if (combined.includes(signal)) {
      penalty += 40;
      console.log(`[evaluator] deterministic penalty: "${signal}" found in claim ${claim.id}`);
    }
  }
  for (const signal of DIGITAL_ONLY_SUBMISSION_SIGNALS) {
    if (combined.includes(signal)) {
      penalty += 25;
      console.log(`[evaluator] digital-only penalty: "${signal}" found in claim ${claim.id}`);
    }
  }

  // Duplicate-evidence penalty: suspiciously short description
  if (claim.description.trim().length < 10) {
    penalty += 20;
  }

  return Math.max(0, overlapScore - penalty);
}

// ---------------------------------------------------------------------------
// OCR via free public OCR service (ocr.space — no Tesseract needed serverless)
// ---------------------------------------------------------------------------
// Extracts text from images. Useful for bounties requiring handwritten notes,
// dates, usernames written in the photo, etc.

async function extractTextFromImage(imageUrl: string): Promise<string | null> {
  const apiKey = process.env.OCR_SPACE_API_KEY ?? "helloworld"; // helloworld = free public key
  try {
    const form = new URLSearchParams();
    form.append("url", imageUrl);
    form.append("apikey", apiKey);
    form.append("language", "eng");
    form.append("isOverlayRequired", "false");

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      IsErroredOnProcessing?: boolean;
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (data.IsErroredOnProcessing) return null;

    const text = data.ParsedResults?.[0]?.ParsedText?.trim();
    if (!text || text.length < 5) return null;

    const cleaned = text.replace(/\r\n/g, " ").replace(/\s+/g, " ").slice(0, 500);
    console.log(`[evaluator] OCR extracted ${cleaned.length} chars from ${imageUrl.slice(0, 60)}`);
    return cleaned;
  } catch (err) {
    console.warn(`[evaluator] OCR failed for ${imageUrl.slice(0, 60)}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// URI normalization
// ---------------------------------------------------------------------------

function normalizeUri(uri: string): string {
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  if (uri.startsWith("ar://")) return `https://arweave.net/${uri.slice(5)}`;
  return uri;
}

// ---------------------------------------------------------------------------
// Vision AI
// ---------------------------------------------------------------------------

// Fetch an image URL and convert to base64 data URI so vision models don't need to fetch it directly
async function fetchImageAsBase64(imageUrl: string): Promise<{ dataUrl: string; mimeType: string } | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const mimeType = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
  } catch {
    return null;
  }
}

// Use Groq vision API (free tier, very generous limits)
async function describeImageWithGroq(imageData: { dataUrl: string; mimeType: string }, bountyName: string, bountyDescription: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const textPrompt = `you are verifying a submission for a real-world bounty.

bounty: "${bountyName}"
requirements: "${bountyDescription}"

describe what you see in this image in 2-3 sentences. you MUST specifically address each requirement from the bounty description above — check each one explicitly. mention: every word or piece of text visible in the image, whether it is indoors or outdoors, what action or scene is depicted, and whether the image appears real/unedited. be as specific as possible about what text is written and what is missing.`;

  const groqModels = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview",
  ];

  for (const model of groqModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: textPrompt },
              { type: "image_url", image_url: { url: imageData.dataUrl } },
            ],
          }],
          max_tokens: 200,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          console.log(`[evaluator] groq vision (${model}): ${text.slice(0, 100)}`);
          return text;
        }
      } else if (res.status === 429) {
        console.warn(`[evaluator] groq ${model} rate limited, trying next`);
        continue;
      } else {
        console.warn(`[evaluator] groq ${model} returned ${res.status}: ${await res.text().catch(() => "")}`);
      }
    } catch (err) {
      console.warn(`[evaluator] groq ${model} failed:`, err);
    }
  }
  return null;
}


async function describeImageWithOpenAI(imageData: { dataUrl: string }, bountyName: string, bountyDescription: string): Promise<{ content: string; promptTokens: number; completionTokens: number; estimatedCostUsd: number } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const textPrompt = `you are verifying a submission for a real-world bounty.

bounty: "${bountyName}"
requirements: "${bountyDescription}"

describe what you see in this image in 2-3 sentences. you MUST specifically address each requirement from the bounty description above — check each one explicitly. mention: every word or piece of text visible in the image, whether it is indoors or outdoors, what action or scene is depicted, and whether the image appears real/unedited. be as specific as possible about what text is written and what is missing.`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: textPrompt },
            { type: "image_url", image_url: { url: imageData.dataUrl } },
          ],
        }],
        max_tokens: 200,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) {
        const promptTokens = data.usage?.prompt_tokens ?? 0;
        const completionTokens = data.usage?.completion_tokens ?? 0;
        // gpt-4o pricing: $2.50/1M input, $10/1M output
        const estimatedCostUsd = (promptTokens * 0.0000025) + (completionTokens * 0.00001);
        console.log(`[evaluator] openai vision (gpt-4o): ${content.slice(0, 100)} | tokens=${promptTokens}+${completionTokens} cost=$${estimatedCostUsd.toFixed(4)}`);
        return { content, promptTokens, completionTokens, estimatedCostUsd };
      }
    } else {
      console.warn(`[evaluator] openai vision returned ${res.status}: ${await res.text().catch(() => "")}`);
    }
  } catch (err) {
    console.warn(`[evaluator] openai vision failed:`, err);
  }
  return null;
}

// Tracks OpenAI vision cost for the current evaluation (reset per claim)
let _lastOpenAIVisionCost: { promptTokens: number; completionTokens: number; estimatedCostUsd: number } | null = null;
// Paid fallbacks are opt-in. Free stack is default.
const ENABLE_OPENAI_VISION_FALLBACK = process.env.ENABLE_OPENAI_VISION_FALLBACK === "true";
const ENABLE_OPENAI_AI_DETECTION = process.env.ENABLE_OPENAI_AI_DETECTION === "true";

async function describeImageWithVision(imageUrl: string, bountyName: string, bountyDescription: string): Promise<string | null> {
  _lastOpenAIVisionCost = null;
  const imageData = await fetchImageAsBase64(imageUrl);
  if (!imageData) {
    console.warn(`[evaluator] could not fetch image as base64: ${imageUrl.slice(0, 60)}`);
    return null;
  }

  // Tier 1: Groq (free, fast)
  const groqResult = await describeImageWithGroq(imageData, bountyName, bountyDescription);
  if (groqResult) return groqResult;

  // Tier 2: OpenAI gpt-4o paid fallback (explicit opt-in only)
  if (ENABLE_OPENAI_VISION_FALLBACK) {
    const openaiResult = await describeImageWithOpenAI(imageData, bountyName, bountyDescription);
    if (openaiResult) {
      _lastOpenAIVisionCost = {
        promptTokens: openaiResult.promptTokens,
        completionTokens: openaiResult.completionTokens,
        estimatedCostUsd: openaiResult.estimatedCostUsd,
      };
      return openaiResult.content;
    }
  }

  // Tier 3: OpenRouter fallback
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    const imageContent = { type: "image_url" as const, image_url: { url: imageData.dataUrl } };
    const textPrompt = `you are verifying a submission for a real-world bounty.

bounty: "${bountyName}"
requirements: "${bountyDescription}"

describe what you see in this image in 2-3 sentences. you MUST specifically address each requirement from the bounty description above — check each one explicitly. mention: every word or piece of text visible in the image, whether it is indoors or outdoors, what action or scene is depicted, and whether the image appears real/unedited. be as specific as possible about what text is written and what is missing.`;

    const visionModels = [
      "qwen/qwen3.6-plus:free",
      "google/gemini-3.1-flash-lite-preview",
    ];

    for (const model of visionModels) {
      try {
        const res = await fetch(OPENROUTER_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.BOT_APP_URL ?? `https://${process.env.BOT_USERNAME ?? "poidh-sentinel"}.neynar.app`,
            "X-Title": process.env.BOT_USERNAME ?? "poidh-sentinel",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: [{ type: "text", text: textPrompt }, imageContent] }],
            max_tokens: 200,
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
          const content = data.choices?.[0]?.message?.content?.trim();
          if (content) {
            console.log(`[evaluator] openrouter vision via ${model}: ${content.slice(0, 100)}`);
            return content;
          }
        } else {
          console.warn(`[evaluator] openrouter vision ${model} returned ${res.status}`);
        }
      } catch (err) {
        console.warn(`[evaluator] openrouter vision ${model} failed:`, err);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Proof URI resolver — fetches metadata, runs OCR + vision on images
//
// Optimization strategy to conserve Groq vision quota:
//   1. Run OCR first (free, unlimited). If OCR returns enough text to judge
//      the claim, skip vision entirely — most text-based bounties need no vision.
//   2. Only call vision if the claim's deterministic score is ≥ 40. Claims
//      below that threshold are unlikely to be winners anyway.
// ---------------------------------------------------------------------------

// How many characters of OCR text counts as "rich enough" to skip vision
const OCR_SUFFICIENT_CHARS = 30;

// Minimum deterministic score required before spending a vision API call
const VISION_SCORE_GATE = 40;

async function resolveImageProof(
  imageUrl: string,
  bountyName: string,
  bountyDescription: string,
  deterministicScoreHint: number,
): Promise<string> {
  // Skip vision entirely for low-scoring claims — not worth the quota
  if (deterministicScoreHint < VISION_SCORE_GATE) {
    console.log(`[evaluator] skipping vision — det score ${deterministicScoreHint} < ${VISION_SCORE_GATE}`);
    // Still run OCR as it's free
    const ocrText = await extractTextFromImage(imageUrl);
    return ocrText ? `OCR TEXT IN IMAGE: "${ocrText}"` : `image proof at ${imageUrl} (no text detected)`;
  }

  // Run free-first vision pipeline first. OpenAI-based AI-image detection is opt-in.
  const vision = await describeImageWithVision(imageUrl, bountyName, bountyDescription);
  const aiDetectRaw = ENABLE_OPENAI_AI_DETECTION ? await detectAiImage(imageUrl) : null;

  // Parse AI detection result — detectAiImage returns a human-readable string like
  // "🤖 looks ai-generated (80% confident). shadow inconsistency near subject."
  // We want to know if it's flagged AI so we can warn the LLM evaluator.
  let aiDetectNote: string | null = null;
  if (aiDetectRaw) {
    const lower = aiDetectRaw.toLowerCase();
    if (lower.includes("looks ai-generated") || lower.includes("🤖")) {
      aiDetectNote = `AI DETECTION WARNING: image may be AI-generated — ${aiDetectRaw}`;
    } else if (lower.includes("hard to tell") || lower.includes("🤔")) {
      aiDetectNote = `AI DETECTION: authenticity uncertain — ${aiDetectRaw}`;
    }
    // REAL verdict: don't add noise to the prompt
  }

  if (vision) {
    // Vision succeeded — also append OCR if it adds text not captured by vision
    const ocrText = await extractTextFromImage(imageUrl);
    const parts: string[] = [`VISION ANALYSIS: ${vision}`];
    if (ocrText && ocrText.length >= OCR_SUFFICIENT_CHARS) {
      parts.push(`OCR TEXT IN IMAGE: "${ocrText}"`);
    }
    if (aiDetectNote) parts.push(aiDetectNote);
    return parts.join(" | ");
  }

  // Vision failed — fall back to OCR, still surface AI detection result
  console.log(`[evaluator] vision unavailable — falling back to OCR`);
  const ocrText = await extractTextFromImage(imageUrl);
  const parts: string[] = [];
  if (ocrText) parts.push(`OCR TEXT IN IMAGE: "${ocrText}"`);
  if (aiDetectNote) parts.push(aiDetectNote);
  if (parts.length > 0) return parts.join(" | ");

  return `image proof at ${imageUrl} (analysis unavailable)`;
}

async function resolveProofUri(
  uri: string,
  bountyName: string,
  bountyDescription: string,
  deterministicScoreHint = 100,
): Promise<string> {
  if (!uri) return "no proof uri provided";

  try {
    const url = normalizeUri(uri);

    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    const contentType = res.headers.get("content-type") ?? "";

    if (contentType.startsWith("image/")) {
      return resolveImageProof(url, bountyName, bountyDescription, deterministicScoreHint);
    }

    if (contentType.startsWith("video/")) {
      return `video proof at ${url} — evaluator cannot view video directly; evaluate based on submission name/description`;
    }

    if (contentType.includes("json")) {
      const jsonRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const meta = (await jsonRes.json()) as { image?: string; animation_url?: string; name?: string; description?: string };
      const imageUrl = meta.image ?? meta.animation_url;
      if (imageUrl) {
        const normalizedImage = normalizeUri(imageUrl);
        return resolveImageProof(normalizedImage, bountyName, bountyDescription, deterministicScoreHint);
      }
      return `nft metadata: name="${meta.name ?? ""}", description="${meta.description ?? ""}"`;
    }

    return `proof at ${url} (type: ${contentType || "unknown"})`;
  } catch {
    return `proof uri: ${uri} (could not fetch)`;
  }
}

// ---------------------------------------------------------------------------
// Claim evaluator
// ---------------------------------------------------------------------------

export async function evaluateClaim(
  bountyName: string,
  bountyDescription: string,
  claim: ClaimData,
  bountyCreatedAt?: bigint | number,
): Promise<EvaluationResult> {
  // --- Step 1: Deterministic pre-filter ---
  const detScore = deterministicScore(bountyName, bountyDescription, claim);
  console.log(`[evaluator] claim ${claim.id} deterministic score: ${detScore}`);

  if (detScore < DETERMINISTIC_REJECT_THRESHOLD) {
    console.log(`[evaluator] claim ${claim.id} rejected by deterministic pre-filter (score=${detScore})`);
    return {
      claimId: claim.id,
      issuer: claim.issuer,
      score: 0,
      valid: false,
      reasoning: "submission doesn't match bounty requirements",
      deterministicScore: detScore,
    };
  }

  // --- Step 2: Fetch + analyze proof (OCR first, vision only if score ≥ gate) ---
  const proofSummary = await resolveProofUri(claim.uri, bountyName, bountyDescription, detScore);

  // --- Step 3: LLM final evaluation ---
  const bountyDate = formatBountyDate(bountyCreatedAt);
  // Compute the deadline date (creation + 72h) so we can accept submissions from any day in the window
  const bountyDeadlineDate = bountyCreatedAt
    ? formatBountyDate(
        typeof bountyCreatedAt === "bigint"
          ? bountyCreatedAt + BigInt(72 * 3600)
          : Number(bountyCreatedAt) + 72 * 3600,
      )
    : null;
  const dateContext = bountyDate
    ? `\nIMPORTANT: this bounty was created on ${bountyDate} and is open for 72 hours (until ${bountyDeadlineDate ?? "72h later"}). if the bounty requires "today's date", any date from ${bountyDate} through ${bountyDeadlineDate ?? "72h after creation"} is valid — do NOT reject a submission just because it shows a date one or two days after the creation date. evaluate against this window, not the current date.`
    : "";

  const prompt = `you are evaluating a submission for a real-world bounty on poidh (pics or it didn't happen).

bounty: "${bountyName}"
bounty description: "${bountyDescription}"${dateContext}

submission:
- name: "${claim.name}"
- description: "${claim.description}"
- proof: ${proofSummary}

evaluate this submission. does it satisfy the bounty requirements?

important rules:
- if the bounty asks for "your username", any username written in the image counts — do NOT try to verify it matches a wallet address or on-chain identity
- judge only what is visible in the proof image and the submission text
- be generous with minor variations (e.g. "5th April" vs "April 5th" both count as the same date)
- if the proof contains an "AI DETECTION WARNING", the image is likely AI-generated — set valid=false and penalize the score heavily (max 20). poidh requires real-world photographic proof, not AI-generated images
- if the proof contains "AI DETECTION: authenticity uncertain", reduce the score by 20-30 points to reflect the doubt

respond with ONLY a JSON object (no markdown, no explanation outside the JSON):
{
  "valid": true/false,
  "score": 0-100,
  "reasoning": "one specific sentence under 120 chars describing WHAT you saw (e.g. 'outdoor photo shows handwritten note reading 5th april 2026 and poidh text on a bench'). be concrete — mention actual text visible, location, or specific visual details. never write 'meets requirements' or vague phrases."
}`;

  try {
    const raw = await callLLM(prompt);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no json in response");

    const parsed = JSON.parse(jsonMatch[0]) as { valid: boolean; score: number; reasoning: string };

    return {
      claimId: claim.id,
      issuer: claim.issuer,
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      valid: Boolean(parsed.valid),
      reasoning: String(parsed.reasoning ?? "").slice(0, 150),
      deterministicScore: detScore,
      openaiVisionCost: _lastOpenAIVisionCost ?? undefined,
    };
  } catch {
    // All LLMs exhausted — fall back to deterministic score as a proxy
    // so quota outages don't silently discard valid submissions
    const fallbackScore = detScore;
    const fallbackValid = detScore >= 60;
    console.warn(`[evaluator] claim ${claim.id} — all LLMs failed, using deterministic fallback score=${fallbackScore}`);
    return {
      claimId: claim.id,
      issuer: claim.issuer,
      score: fallbackScore,
      valid: fallbackValid,
      reasoning: proofSummary.startsWith("OCR TEXT") || proofSummary.startsWith("VISION")
        ? `llm unavailable — based on proof: ${proofSummary.slice(0, 80)}`
        : "llm unavailable — evaluated from submission text only",
      deterministicScore: detScore,
    };
  }
}

// ---------------------------------------------------------------------------
// Winner picker
// ---------------------------------------------------------------------------

// Normalize a proof URI for duplicate comparison:
// strips query params, trims whitespace, lowercases
function normalizeProofUri(uri: string): string {
  try {
    const url = new URL(uri);
    return `${url.origin}${url.pathname}`.toLowerCase().trim();
  } catch {
    return uri.toLowerCase().trim();
  }
}

// Compute a difference hash (dHash) for an image URL.
// Resize to 9x8 grayscale, compare adjacent pixels left→right → 64-bit hash as BigInt.
// Returns null if the image can't be fetched or processed.
async function computeDHash(imageUrl: string): Promise<bigint | null> {
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let hash = 0n;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        hash = (hash << 1n) | (left > right ? 1n : 0n);
      }
    }
    return hash;
  } catch {
    return null;
  }
}

// Hamming distance between two 64-bit hashes
function hammingDistance(a: bigint, b: bigint): number {
  let diff = a ^ b;
  let dist = 0;
  while (diff > 0n) {
    dist += Number(diff & 1n);
    diff >>= 1n;
  }
  return dist;
}

// Maximum Hamming distance to consider two images visually identical (out of 64 bits).
// ≤ 10 catches re-uploads, minor crops, and compression artifacts without false positives.
const DHASH_DUPLICATE_THRESHOLD = 10;

// Resolve a claim's proof URI to its actual image URL (handles IPFS JSON metadata)
async function resolveImageUrl(uri: string): Promise<string | null> {
  if (!uri) return null;
  try {
    const url = normalizeUri(uri);
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) return url;
    if (contentType.includes("json")) {
      const jsonRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const meta = (await jsonRes.json()) as { image?: string; animation_url?: string };
      const imgUrl = meta.image ?? meta.animation_url;
      return imgUrl ? normalizeUri(imgUrl) : null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function pickWinner(
  bountyName: string,
  bountyDescription: string,
  claims: ClaimData[],
  bountyCreatedAt?: bigint | number,
  options?: { returnAllResultsIfNoWinner?: boolean },
): Promise<{ winnerClaimId: string; reasoning: string; allResults: EvaluationResult[] } | null> {
  if (claims.length === 0) return null;

  // Duplicate proof detection (canonicalized):
  // 1) resolve metadata URI -> underlying image URL when possible
  // 2) dedupe on that canonical URL (or original URI fallback)
  // Earliest submission keeps credit; later duplicates are disqualified.
  const keyToFirstClaimId = new Map<string, string>();
  const plagiarizedClaimIds = new Set<string>();
  const sortedByAge = [...claims].sort((a, b) => Number(BigInt(a.id) - BigInt(b.id)));
  const resolvedImageUrls = await Promise.all(sortedByAge.map((c) => resolveImageUrl(c.uri)));
  const resolvedImageUrlByClaimId = new Map<string, string>();

  for (let idx = 0; idx < sortedByAge.length; idx++) {
    const claim = sortedByAge[idx];
    const resolvedImageUrl = resolvedImageUrls[idx];
    if (resolvedImageUrl) resolvedImageUrlByClaimId.set(claim.id, resolvedImageUrl);

    // Prefer resolved image URL to catch cases where two different metadata URIs
    // point to the same underlying image.
    const canonicalProofUri = resolvedImageUrl ?? claim.uri;
    const key = normalizeProofUri(canonicalProofUri);
    if (!key || key === "no proof uri provided") continue;
    if (keyToFirstClaimId.has(key)) {
      plagiarizedClaimIds.add(claim.id);
      const originalClaimId = keyToFirstClaimId.get(key);
      console.log(
        `[evaluator] claim ${claim.id} disqualified — duplicate proof key of claim ${originalClaimId}` +
        (resolvedImageUrl ? ` (resolved image URL: ${resolvedImageUrl})` : ""),
      );
    } else {
      keyToFirstClaimId.set(key, claim.id);
    }
  }

  // Perceptual duplicate detection — catches re-uploads of the same image with a
  // different IPFS hash (different URI, identical pixels). Compute dHash for each
  // non-URI-duplicate claim in parallel, then flag any pair with Hamming distance ≤ threshold.
  // Earlier claim (lower ID) wins; later visually-identical claims are disqualified.
  const nonDupClaims = sortedByAge.filter((c) => !plagiarizedClaimIds.has(c.id));
  const imageUrls = await Promise.all(
    nonDupClaims.map((c) => {
      const cachedResolved = resolvedImageUrlByClaimId.get(c.id);
      return cachedResolved ? Promise.resolve(cachedResolved) : resolveImageUrl(c.uri);
    }),
  );
  const dHashes = await Promise.all(
    imageUrls.map((url) => (url ? computeDHash(url) : Promise.resolve(null))),
  );

  for (let i = 0; i < nonDupClaims.length; i++) {
    if (plagiarizedClaimIds.has(nonDupClaims[i].id)) continue; // already flagged
    const hashA = dHashes[i];
    if (!hashA) continue;
    for (let j = i + 1; j < nonDupClaims.length; j++) {
      if (plagiarizedClaimIds.has(nonDupClaims[j].id)) continue;
      const hashB = dHashes[j];
      if (!hashB) continue;
      const dist = hammingDistance(hashA, hashB);
      if (dist <= DHASH_DUPLICATE_THRESHOLD) {
        plagiarizedClaimIds.add(nonDupClaims[j].id);
        console.log(
          `[evaluator] claim ${nonDupClaims[j].id} disqualified — visually identical to claim ${nonDupClaims[i].id} (hamming=${dist})`,
        );
      }
    }
  }

  const results = await Promise.all(
    claims.map((c) => {
      if (plagiarizedClaimIds.has(c.id)) {
        // Short-circuit — no API calls needed
        return Promise.resolve<EvaluationResult>({
          claimId: c.id,
          score: 0,
          valid: false,
          reasoning: "duplicate proof — same image already submitted by an earlier claim",
        });
      }
      return evaluateClaim(bountyName, bountyDescription, c, bountyCreatedAt);
    }),
  );

  const validResults = results.filter((r) => r.valid && r.score >= 60);
  if (validResults.length === 0) {
    if (options?.returnAllResultsIfNoWinner) {
      return {
        winnerClaimId: "",
        reasoning: "",
        allResults: results,
      };
    }
    return null;
  }

  validResults.sort((a, b) => b.score - a.score);
  const winner = validResults[0];

  return {
    winnerClaimId: winner.claimId,
    reasoning: winner.reasoning,
    allResults: results,
  };
}
