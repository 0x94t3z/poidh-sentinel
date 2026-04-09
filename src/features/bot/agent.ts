import "server-only";
import type { AgentContext, AgentResponse, BountyAction } from "@/features/bot/types";
import { fetchCastThread } from "@/features/bot/cast-reply";
import { getBountyDetails } from "@/features/bot/poidh-contract";
import { getActiveBounties } from "@/features/bot/bounty-store";
import { formatEther } from "viem";
import { validateRealWorldBounty } from "@/features/bot/bounty-validation";
import { MIN_OPEN_DURATION_HOURS } from "@/features/bot/constants";

// Bounty ideas the bot autonomously creates on-chain
const AUTONOMOUS_BOUNTY_IDEAS = [
  {
    name: "find a real rainbow over a city",
    description: "photograph a full or partial rainbow clearly visible over a recognizable city skyline or urban area. must show buildings in frame. no digital edits.",
    amountEth: "0.001",
  },
  {
    name: "catch a stranger being kind",
    description: "photograph or short video of a stranger doing something genuinely kind for another person in public — holding a door, helping someone carry something, giving directions. candid, real, unposed.",
    amountEth: "0.001",
  },
  {
    name: "find the tallest thing you can stand next to",
    description: "photo of yourself standing next to the tallest natural or man-made object you can find — tree, tower, cliff, building. you must be visible in frame for scale.",
    amountEth: "0.001",
  },
];

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";

// Cerebras models — free tier, extremely fast (~2000 tok/s)
const CEREBRAS_MODELS = [
  "llama-3.3-70b",
  "llama3.1-8b",
];

// OpenRouter free models — fallback if Cerebras fails
const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "stepfun/step-3.5-flash:free",
  "arcee-ai/trinity-mini:free",
];

const BOT_USERNAME = process.env.BOT_USERNAME ?? "poidh-sentinel";
const BOT_APP_URL = process.env.BOT_APP_URL ?? `https://${BOT_USERNAME}.neynar.app`;

const SYSTEM_PROMPT = `you are ${BOT_USERNAME}, an autonomous bounty agent for the poidh (pics or it didn't happen) platform on farcaster.

poidh is an on-chain bounty protocol on arbitrum, base, and degen chain. users create open bounties with ETH or DEGEN, anyone can submit proof (photo/video), and the community votes on the winner. bounties are for real-world tasks only — no digital-only submissions.

your personality:
- direct, witty, lowercase always
- sound like a person not a bot
- concise — farcaster has a 320 char limit, stay well under it
- never use markdown, no bullet points, no bold, no headers
- never say "as an ai", "i'm an ai", "i cannot", or any disclaimer
- never start with "i'd love to", "great question", "sure!", or similar filler
- NEVER fabricate outcomes — if you see a previous message saying "cancel failed" or an error, do NOT say the cancel succeeded. be honest: "the cancel failed — try again by replying 'cancel bounty' in the announcement thread."
- if someone asks "what's that mean" or similar after an error message, explain the error plainly — do not invent a different outcome
- NEVER introduce yourself mid-conversation ("i'm ${BOT_USERNAME}..." is banned unless someone literally asks who you are)
- NEVER reset the conversation or ignore prior context — always read the thread history and stay on topic
- if someone asks about a bounty's current value or status, tell them to check poidh.xyz — you don't have live contract data in this context

your capabilities:
- suggest creative, specific, real-world bounty ideas
- help users create bounties on-chain (they fund it, you deploy it)
- evaluate whether a submission qualifies as valid proof
- pick winners from a set of submissions
- explain how poidh works

key facts about poidh:
- bounties require a minimum of 0.001 ETH (arbitrum/base) or 1000 DEGEN (degen chain)
- open bounties are crowdfunded — anyone can add to the prize pool at any time
- submissions stay open for ${MIN_OPEN_DURATION_HOURS}h after bounty creation before the bot picks a winner — this gives everyone a fair window to submit proof
- winner selection for open bounties with external contributors is a 2-step process:
  1. the bot nominates the best submission via submitClaimForVote (starts a 48h voting window)
  2. after 48h, anyone can call resolveVote — claim wins if YES votes exceed 50% of contributor weight
- if no external contributors, the bot can accept a claim directly with no voting required
- proof must be original, recent, unedited photos or videos submitted on poidh.xyz
- bounty link format: poidh.xyz/{chain}/bounty/{id}
- do NOT invent rules beyond what's above — if unsure, say "check poidh.xyz for details"
- ALWAYS call bounties "open bounties" — NEVER use the word "single" to describe a bounty type. poidh only creates open bounties.
- cancellation: only the bounty issuer (this bot) can cancel. if anyone asks how to cancel, tell them to reply "cancel bounty" and tag @${BOT_USERNAME} in the bounty announcement thread. the contract automatically refunds all contributors when an open bounty is cancelled. cancellation is blocked while a community vote is in progress — must wait for the vote to resolve first.
- no submissions after ${MIN_OPEN_DURATION_HOURS}h: the bounty stays open indefinitely — it does NOT auto-close or auto-refund. the creator can cancel at any time for a full deposit refund, or share the link to attract submitters. the bot posts a reminder at ${MIN_OPEN_DURATION_HOURS}h and again every 48h after 7 days with no submissions.`;

// Fetch live pot value for a bounty from the contract (with 8s timeout)
async function fetchLivePotValue(bountyId: string, chain: string): Promise<string | null> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 8000),
    );
    const details = await Promise.race([
      getBountyDetails(BigInt(bountyId), chain),
      timeout,
    ]);
    const eth = parseFloat(formatEther(details.amount));
    const formatted = eth.toFixed(6).replace(/\.?0+$/, "");
    console.log(`[agent] live pot for bounty ${bountyId} on ${chain}: ${formatted}`);
    return formatted;
  } catch (err) {
    console.warn(`[agent] fetchLivePotValue failed for ${bountyId} on ${chain}:`, err);
    return null;
  }
}

// Try to find the most relevant active bounty for a context (bountyContext or most recent open bounty)
async function resolveActiveBounty(ctx: AgentContext): Promise<{ bountyId: string; chain: string } | null> {
  try {
    const all = await getActiveBounties(); // already ordered newest first
    const open = all.filter((b) => !b.bountyId.startsWith("pending-"));

    if (ctx.bountyContext) {
      // Prefer exact bountyId match — avoids returning the wrong bounty when multiple exist on the same chain
      if (ctx.bountyContext.bountyId) {
        const idMatch = open.find((b) => b.bountyId === ctx.bountyContext!.bountyId);
        if (idMatch) {
          console.log(`[agent] resolveActiveBounty: matched by id — bountyId=${idMatch.bountyId} chain=${idMatch.chain}`);
          return { bountyId: idMatch.bountyId, chain: idMatch.chain };
        }
      }
      // Fallback: exact name + chain match
      const match = open.find((b) => b.name === ctx.bountyContext!.name && b.chain === ctx.bountyContext!.chain);
      if (match) {
        console.log(`[agent] resolveActiveBounty: matched by name — bountyId=${match.bountyId} chain=${match.chain}`);
        return { bountyId: match.bountyId, chain: match.chain };
      }
    }

    // Fall back to newest open bounty across all chains
    if (open.length > 0) {
      console.log(`[agent] resolveActiveBounty: using newest open bounty — bountyId=${open[0].bountyId} chain=${open[0].chain}`);
      return { bountyId: open[0].bountyId, chain: open[0].chain };
    }
  } catch (err) {
    console.warn("[agent] resolveActiveBounty failed:", err);
  }
  return null;
}

function isAskingAboutPot(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("bounty value") ||
    lower.includes("bounty pot") ||
    lower.includes("pot value") ||
    lower.includes("how much") ||
    lower.includes("how many") ||
    lower.includes("total funds") ||
    lower.includes("prize pool") ||
    lower.includes("prize pot") ||
    lower.includes("contributed") ||
    lower.includes("in the bounty") ||
    lower.includes("bounty worth") ||
    lower.includes("bounty amount")
  );
}

async function detectAction(text: string): Promise<BountyAction> {
  const lower = text.toLowerCase();

  // Deterministic shortcuts — these phrases are unambiguous, no LLM needed
  if (
    lower.includes("who wins") ||
    lower.includes("pick a winner") ||
    lower.includes("pick winner") ||
    lower.includes("choose winner") ||
    lower.includes("best submission") ||
    lower.includes("select winner")
  ) {
    return "pick_winner";
  }

  if (
    lower.includes("does this count") ||
    lower.includes("is this valid") ||
    lower.includes("evaluate") ||
    lower.includes("does this qualify") ||
    lower.includes("submission") ||
    lower.includes("proof")
  ) {
    return "evaluate_submission";
  }

  if (
    lower.includes("fund") ||
    lower.includes("wallet address") ||
    lower.includes("send eth") ||
    lower.includes("send money") ||
    lower.includes("add money") ||
    lower.includes("your address") ||
    (lower.includes("wallet") && lower.includes("address"))
  ) {
    return "wallet_address";
  }

  if (
    lower.includes("post a bounty") ||
    lower.includes("launch a bounty") ||
    lower.includes("deploy a bounty") ||
    lower.includes("create on-chain") ||
    lower.includes("put up a bounty") ||
    lower.includes("start a bounty") ||
    lower.includes("make it live") ||
    lower.includes("go live")
  ) {
    return "create_bounty_onchain";
  }

  // LLM-based intent classifier for suggest_bounty vs general_reply.
  // Keyword matching was too broad — celebratory / ambient mentions could incorrectly
  // trigger bounty-creation flow.
  try {
    const apiKey = process.env.CEREBRAS_API_KEY ?? process.env.GROQ_API_KEY ?? process.env.OPENROUTER_API_KEY;
    if (apiKey) {
      const endpoint = process.env.CEREBRAS_API_KEY
        ? CEREBRAS_API_URL
        : process.env.GROQ_API_KEY
          ? "https://api.groq.com/openai/v1/chat/completions"
          : OPENROUTER_API_URL;

      const model = process.env.CEREBRAS_API_KEY
        ? "llama3.1-8b"
        : process.env.GROQ_API_KEY
          ? "llama-3.1-8b-instant"
          : "meta-llama/llama-3.3-70b-instruct:free";

      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };

      if (!process.env.CEREBRAS_API_KEY && !process.env.GROQ_API_KEY) {
        headers["HTTP-Referer"] = BOT_APP_URL;
        headers["X-Title"] = BOT_USERNAME;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                'You classify Farcaster messages directed at a bounty bot. Reply with ONLY one word.\n\n' +
                'Reply "suggest_bounty" ONLY if the person is explicitly asking the bot to help them create or suggest a NEW bounty right now — e.g. "suggest a bounty idea", "help me make a bounty", "what bounty should I create?".\n\n' +
                'Reply "general_reply" for EVERYTHING else: announcements, celebrations, congratulations, questions about how things work, commenting on an existing bounty, tagging the bot in passing, sharing news, or anything ambiguous.\n\n' +
                'When in doubt, reply "general_reply". Only use "suggest_bounty" when the intent to create a new bounty right now is crystal clear.',
            },
            { role: "user", content: text },
          ],
          max_tokens: 10,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const answer = data.choices?.[0]?.message?.content?.trim().toLowerCase() ?? "";
        if (answer.includes("suggest_bounty")) {
          console.log("[agent] detectAction LLM -> suggest_bounty");
          return "suggest_bounty";
        }
        console.log(`[agent] detectAction LLM -> general_reply (raw: "${answer}")`);
        return "general_reply";
      }
    }
  } catch (err) {
    console.warn("[agent] detectAction LLM fallback failed:", err);
  }

  // Safe default — if classifier is unavailable, don't assume bounty creation intent
  return "general_reply";
}

async function callLLM(
  messages: Array<{ role: string; content: string }>,
  modelIndex = 0,
  maxTokens = 300,
): Promise<string> {
  // Tier 1: Cerebras (fast, free, preferred)
  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (cerebrasKey && modelIndex < CEREBRAS_MODELS.length) {
    const model = CEREBRAS_MODELS[modelIndex];
    try {
      const res = await fetch(CEREBRAS_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cerebrasKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[agent] cerebras/${model} responded`);
          return content;
        }
      }
      if (modelIndex + 1 < CEREBRAS_MODELS.length) {
        return callLLM(messages, modelIndex + 1, maxTokens);
      }
    } catch (err) {
      console.warn(`[agent] cerebras error:`, err);
    }
  }

  // Tier 2: Groq (free tier, reliable fallback)
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens: maxTokens, temperature: 0.7 }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) {
          console.log(`[agent] groq responded`);
          return content;
        }
      } else {
        console.warn(`[agent] groq returned ${res.status}`);
      }
    } catch (err) {
      console.warn(`[agent] groq error:`, err);
    }
  }

  // Tier 3: OpenRouter free models (last resort)
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) throw new Error("No LLM API key configured (CEREBRAS_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY)");

  const orIndex = Math.max(0, modelIndex - CEREBRAS_MODELS.length);
  return callOpenRouter(messages, orIndex, maxTokens);
}

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  modelIndex = 0,
  maxTokens = 300,
): Promise<string> {
  const model = OPENROUTER_MODELS[modelIndex] ?? OPENROUTER_MODELS[0];
  const apiKey = process.env.OPENROUTER_API_KEY!;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": BOT_APP_URL,
      "X-Title": BOT_USERNAME,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
  });

  if (!response.ok) {
    if (modelIndex < OPENROUTER_MODELS.length - 1) {
      console.warn(`[agent] openrouter/${model} failed (${response.status}), trying next...`);
      return callOpenRouter(messages, modelIndex + 1, maxTokens);
    }
    const errorText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    if (modelIndex < OPENROUTER_MODELS.length - 1) {
      console.warn(`[agent] openrouter/${model} returned empty, trying next...`);
      return callOpenRouter(messages, modelIndex + 1, maxTokens);
    }
    throw new Error("All models exhausted — no content returned");
  }

  console.log(`[agent] openrouter/${model} responded`);
  return content;
}

function isAskingAboutAI(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("ai generated") ||
    lower.includes("is this ai") ||
    lower.includes("ai or real") ||
    lower.includes("fake") ||
    lower.includes("ai image") ||
    lower.includes("generated by ai") ||
    lower.includes("looks ai") ||
    lower.includes("ai photo") ||
    lower.includes("photoshop") ||
    lower.includes("ai detect") ||
    lower.includes("real or ai") ||
    lower.includes("is it ai") ||
    (lower.includes("real") && lower.includes("ai"))
  );
}

export interface AiDetectContext {
  threadDiscussion?: Array<{ username: string; text: string }>;
  bountyName?: string;
  bountyDescription?: string;
  /** If true, return a rich debug object instead of a plain string */
  debug?: boolean;
}

export interface AiDetectDebugResult {
  botReply: string;
  pass1: { verdict: string; confidence: number; reasons: string[]; summary: string; usage?: OpenAiUsage } | null;
  pass2: { verdict: string; confidence: number; reasons: string[]; summary: string; usage?: OpenAiUsage } | null;
  chosen: string;
  disagreement: boolean;
  finalConfidence: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
}

interface OpenAiUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Analyze an image URL for AI generation artifacts using gpt-4o.
// Accepts optional thread context — priming with what community members already spotted
// dramatically improves accuracy vs. a cold prompt.
export async function detectAiImage(imageUrl: string, ctx?: AiDetectContext): Promise<string | null> {
  // Feature flag — set AI_IMAGE_DETECTION=false to disable even if OPENAI_API_KEY is set
  if (process.env.AI_IMAGE_DETECTION === "false") return null;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return null;

  try {
    // Fetch image as base64 once, reuse for both passes
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) return null;
    const mimeType = (imgRes.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
    const buffer = await imgRes.arrayBuffer();
    const dataUrl = `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;

    // Build context section from thread discussion — other people's observations prime the model
    // to look at the right things rather than defaulting to "looks real"
    let contextSection = "";
    if (ctx?.bountyName || ctx?.bountyDescription) {
      contextSection += `\nBounty context: "${ctx.bountyName ?? ""}" — ${ctx.bountyDescription ?? ""}\n`;
    }
    if (ctx?.threadDiscussion?.length) {
      const relevant = ctx.threadDiscussion
        .filter((m) => {
          const t = m.text.toLowerCase();
          return (
            t.includes("shadow") || t.includes("ai") || t.includes("fake") ||
            t.includes("real") || t.includes("background") || t.includes("hair") ||
            t.includes("photoshop") || t.includes("generated") || t.includes("hotel") ||
            t.includes("building") || t.includes("location") || t.includes("halo")
          );
        })
        .slice(0, 5)
        .map((m) => `@${m.username}: "${m.text}"`)
        .join("\n");
      if (relevant) {
        contextSection += `\nCommunity observations already made (examine these areas closely):\n${relevant}\n`;
      }
    }

    const prompt = `You are an expert forensic image analyst specializing in AI-generated content detection.
${contextSection}
Examine this image carefully. Focus on:
1. Shadow consistency — do ALL shadows (person, nearby objects, poles, trees) point in the same direction? Any divergence suggests compositing or AI generation.
2. Hair/fur edges — any halo, blur, or unnatural smoothness where hair meets the background?
3. Background landmarks — if there is a recognizable building or location, do ALL architectural details match the real-world location exactly? Any deviation matters.
4. Skin and texture — natural pore variation, or suspiciously smooth/uniform?
5. Overall coherence — does lighting, depth of field, and perspective look consistent across all elements?

Be specific — cite exact parts of the image you can see. Do not say "looks natural" without explaining what specifically looks natural.

Confidence rules (apply strictly):
- REAL above 75%: zero anomalies, AND you can cite specific natural details for each category
- UNCERTAIN 50-70%: any one of — shadow mismatch, hair halo, architectural deviation, or texture anomaly
- AI 70-90%: two or more anomalies found

Respond ONLY in JSON (no markdown):
{"verdict":"AI"|"REAL"|"UNCERTAIN","confidence":0-100,"reasons":["specific observation 1","specific observation 2"],"summary":"one sentence"}`;

    type AnalysisResult = {
      verdict: string; confidence: number; reasons: string[]; summary: string;
      usage?: OpenAiUsage;
    };

    async function runPass(temperature: number): Promise<AnalysisResult | null> {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
          ]}],
          max_tokens: 400,
          temperature,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(25000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: OpenAiUsage;
      };
      const raw = data.choices?.[0]?.message?.content ?? "{}";
      try {
        const p = JSON.parse(raw) as Partial<AnalysisResult>;
        return {
          verdict: p.verdict ?? "UNCERTAIN",
          confidence: p.confidence ?? 0,
          reasons: p.reasons ?? [],
          summary: p.summary ?? "",
          usage: data.usage,
        };
      } catch {
        return null;
      }
    }

    // Run both passes in parallel
    const [pass1, pass2] = await Promise.all([runPass(0.2), runPass(0.8)]);
    const passes = [pass1, pass2].filter(Boolean) as AnalysisResult[];
    if (passes.length === 0) return null;

    // Verdict priority: AI > UNCERTAIN > REAL (most cautious wins)
    const PRIORITY: Record<string, number> = { AI: 3, UNCERTAIN: 2, REAL: 1 };
    passes.sort((a, b) => (PRIORITY[b.verdict] ?? 0) - (PRIORITY[a.verdict] ?? 0));
    const chosen = passes[0];

    // If passes disagree (one REAL, one not), downgrade confidence
    const verdicts = passes.map((p) => p.verdict);
    const disagreement = new Set(verdicts).size > 1;
    const finalConfidence = disagreement ? Math.min(chosen.confidence, 65) : chosen.confidence;

    const { verdict } = chosen;
    // Use only the first reason — keep it short and never cut mid-sentence
    const reason = (chosen.reasons[0] ?? chosen.summary ?? "")
      .replace(/[.!,;]+$/, "")
      .trim();
    const emoji = verdict === "AI" ? "🤖" : verdict === "REAL" ? "📸" : "🤔";
    const label = verdict === "AI" ? "looks ai-generated" : verdict === "REAL" ? "looks like a real photo" : "hard to tell";
    const botReply = `${emoji} ${label} (${finalConfidence}% confident). ${reason}.`.toLowerCase();

    // Tally token usage across both passes
    const totalPrompt = (pass1?.usage?.prompt_tokens ?? 0) + (pass2?.usage?.prompt_tokens ?? 0);
    const totalCompletion = (pass1?.usage?.completion_tokens ?? 0) + (pass2?.usage?.completion_tokens ?? 0);
    const totalTokens = totalPrompt + totalCompletion;
    // gpt-4o pricing (as of 2024): $2.50/1M input, $10/1M output
    const estimatedCostUsd = (totalPrompt * 0.0000025) + (totalCompletion * 0.00001);

    console.log(
      `[agent] ai-detect pass1=${pass1?.verdict ?? "null"} pass2=${pass2?.verdict ?? "null"} ` +
      `chosen=${verdict} conf=${finalConfidence} disagreement=${disagreement} ` +
      `tokens=${totalTokens} cost=$${estimatedCostUsd.toFixed(4)} url=${imageUrl.slice(0, 60)}`
    );

    if (ctx?.debug) {
      const debugResult: AiDetectDebugResult = {
        botReply,
        pass1: pass1 ? { verdict: pass1.verdict, confidence: pass1.confidence, reasons: pass1.reasons, summary: pass1.summary, usage: pass1.usage } : null,
        pass2: pass2 ? { verdict: pass2.verdict, confidence: pass2.confidence, reasons: pass2.reasons, summary: pass2.summary, usage: pass2.usage } : null,
        chosen: verdict,
        disagreement,
        finalConfidence,
        totalTokens,
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        estimatedCostUsd: Math.round(estimatedCostUsd * 100000) / 100000,
      };
      // Return as JSON string so the caller can parse it — callers expecting string still work
      return JSON.stringify(debugResult);
    }

    return botReply;
  } catch (err) {
    console.warn("[agent] detectAiImage failed:", err);
    return null;
  }
}

// Strip markdown formatting that Farcaster doesn't render
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/_(.*?)_/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/^[-*]\s+/gm, "") // remove bullet points
    .replace(/\n{2,}/g, " ")   // collapse newlines
    .trim();
}

export async function runAgent(ctx: AgentContext): Promise<AgentResponse> {
  // AI image detection — only when @poidh-sentinel is directly mentioned (not passive bounty thread).
  // Fetch thread history first so community observations prime the analysis.
  if (ctx.mentioned && isAskingAboutAI(ctx.castText) && ctx.imageUrls?.length) {
    const threadHistory = await fetchCastThread(ctx.threadHash);
    const verdict = await detectAiImage(ctx.imageUrls[0], {
      threadDiscussion: threadHistory,
      bountyName: ctx.bountyContext?.name,
      bountyDescription: ctx.bountyContext?.description,
    });
    if (verdict) {
      return { reply: verdict, action: "general_reply" };
    }
    // detectAiImage failed (no API key, timeout, etc.) — fall through to LLM
  }

  // If we're in a bounty thread OR this is a direct reply to the bot's cast,
  // skip keyword detection entirely — just have a natural conversation.
  // Prevents "good bounty idea!" from triggering a new suggest_bounty flow.
  const inContext = !!(ctx.bountyContext ?? ctx.replyToBot);
  const action = inContext ? "general_reply" : await detectAction(ctx.castText);

  // Wallet address — no LLM needed
  if (action === "wallet_address") {
    // Derive address from private key — BOT_WALLET_ADDRESS is no longer needed
    let address = "not configured";
    try {
      const { getBotWalletAddress } = await import("@/features/bot/poidh-contract");
      address = getBotWalletAddress();
    } catch { /* key not set */ }
    const reply = address === "not configured"
      ? "wallet not configured yet — check back soon."
      : `send ETH (arbitrum/base) or DEGEN (degen chain) to ${address}. minimums: 0.001 ETH or 1000 DEGEN. once i see the deposit i'll create the bounty — submissions stay open for ${MIN_OPEN_DURATION_HOURS}h before i pick a winner.`;
    return { reply, action };
  }

  // On-chain creation — pick from preset ideas, no LLM needed
  if (action === "create_bounty_onchain") {
    const idea = AUTONOMOUS_BOUNTY_IDEAS[Math.floor(Math.random() * AUTONOMOUS_BOUNTY_IDEAS.length)];
    const authorSuffix = ctx.authorUsername ? ` by @${ctx.authorUsername}` : "";
    const namedIdea = {
      ...idea,
      name: `${idea.name}${authorSuffix}`.slice(0, 80),
    };
    const reply = `on it — deploying "${namedIdea.name}" on-chain now with ${idea.amountEth} ETH. anyone can add funds at poidh.xyz. stand by.`;
    return { reply, action, onChainBounty: namedIdea };
  }

  // Fetch thread history so the bot has context for the current reply
  const threadHistory = await fetchCastThread(ctx.threadHash);

  // If the user is asking about the bounty pot value, fetch live values from the contract
  let livePotContext: string | null = null;
  if (isAskingAboutPot(ctx.castText)) {
    if (ctx.bountyContext) {
      // In a specific bounty thread — fetch just that bounty
      const bountyRef = await resolveActiveBounty(ctx);
      if (bountyRef) {
        const live = await fetchLivePotValue(bountyRef.bountyId, bountyRef.chain);
        const curr = bountyRef.chain === "degen" ? "DEGEN" : "ETH";
        console.log(`[agent] pot query (ctx): bountyId=${bountyRef.bountyId} chain=${bountyRef.chain} live=${live ?? "FAILED"}`);
        if (live) {
          livePotContext = `LIVE CONTRACT DATA: pot is ${live} ${curr} on ${bountyRef.chain} (live from contract, includes all contributions). reply with just the amount — no need to repeat the bounty title, they're already in the thread.`;
        } else {
          livePotContext = `LIVE CONTRACT DATA: contract query failed. do NOT make up an amount. tell the user to check poidh.xyz for the current total.`;
        }
      }
    } else {
      // No specific bounty context — fetch ALL open bounties and report them all
      try {
        const allOpen = (await getActiveBounties()).filter((b) => !b.bountyId.startsWith("pending-"));
        if (allOpen.length > 0) {
          const results = await Promise.all(
            allOpen.map(async (b) => {
              const live = await fetchLivePotValue(b.bountyId, b.chain);
              const curr = b.chain === "degen" ? "DEGEN" : "ETH";
              return live ? `"${b.name}": ${live} ${curr} on ${b.chain}` : null;
            }),
          );
          const valid = results.filter(Boolean);
          console.log(`[agent] pot query (all): ${valid.join(" | ")}`);
          if (valid.length > 0) {
            livePotContext = `LIVE CONTRACT DATA for all open bounties:\n${valid.join("\n")}\nUse these exact values. There are ${valid.length} active bounties. List them all clearly.`;
          } else {
            livePotContext = `LIVE CONTRACT DATA: contract queries failed for all bounties. tell the user to check poidh.xyz for current totals.`;
          }
        }
      } catch (err) {
        console.warn("[agent] all-bounties pot query failed:", err);
      }
    }
  }

  const userMessage = buildUserMessage(ctx, action, threadHistory, ctx.bountyContext, livePotContext);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  // suggest_bounty needs more tokens — JSON with name + description + reply easily exceeds 300
  const raw = await callLLM(messages, 0, action === "suggest_bounty" ? 600 : 300);

  // suggest_bounty — expects JSON back, with plain text fallback
  if (action === "suggest_bounty") {
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { name?: string; description?: string; reply?: string };
        const authorSuffix = ctx.authorUsername ? ` by @${ctx.authorUsername}` : "";
        const baseName = (parsed.name ?? "").slice(0, 50).toLowerCase().trim()
          .replace(/[^a-z0-9 \-']/g, "").trim();
        const fullName = `${baseName}${authorSuffix}`.slice(0, 80);
        const replyText = stripMarkdown((parsed.reply ?? raw).slice(0, 320));
        // Strip any hallucinated ETH/reward amounts from the description
        const rawDesc = (parsed.description ?? replyText).slice(0, 500);
        const bountyDescription = rawDesc.replace(/\b\d+(\.\d+)?\s*(eth|degen|usdc|usd|\$)/gi, "").replace(/winner gets.*?[.!]/gi, "").trim();

        // Validate the suggested bounty is real-world (not digital-only)
        const validation = validateRealWorldBounty(fullName, bountyDescription);
        if (!validation.valid) {
          console.log(`[agent] suggested bounty rejected by validation: ${validation.reason}`);
          // Re-prompt the user toward a real-world idea instead
          return {
            reply: "poidh needs real-world photo or video proof — try something like finding a street performer, catching a rainbow, or a random act of kindness. want me to draft one?",
            action: "general_reply",
          };
        }

        return {
          reply: replyText,
          action,
          suggestedIdea: {
            name: fullName || `bounty by @${ctx.authorUsername}`,
            description: bountyDescription,
          },
        };
      } catch {
        // JSON malformed — fall through to plain text
      }
    }

    // Plain text fallback — LLM didn't return valid JSON (truncated or malformed)
    // If raw looks like JSON, don't publish it — use a generic fallback instead
    const looksLikeJson = raw.trimStart().startsWith("{");
    const plain = looksLikeJson
      ? "got a great bounty idea in mind — want me to suggest one for you? just say the word."
      : stripMarkdown(raw).slice(0, 320);
    const authorSuffix = ctx.authorUsername ? ` by @${ctx.authorUsername}` : "";
    const nameGuess = plain.split(/[.!?]/)[0].slice(0, 50).toLowerCase().trim();
    return {
      reply: plain,
      action,
      suggestedIdea: {
        name: `${nameGuess}${authorSuffix}`.slice(0, 80) || `bounty by @${ctx.authorUsername}`,
        description: plain,
      },
    };
  }

  const plain = stripMarkdown(raw);
  const trimmed = plain.length > 320
    ? plain.slice(0, 320).replace(/\s+\S*$/, "") + "..."
    : plain;
  return { reply: trimmed, action };
}

function buildUserMessage(
  ctx: AgentContext,
  action: BountyAction,
  threadHistory: Array<{ username: string; text: string }> = [],
  bountyContext?: AgentContext["bountyContext"],
  livePotContext?: string | null,
): string {
  const historyContext = threadHistory.length > 1
    ? "\nconversation so far:\n" +
      threadHistory.slice(0, -1).map((m) => `@${m.username}: ${m.text}`).join("\n") + "\n"
    : "";

  const current = `@${ctx.authorUsername}: "${ctx.castText}"`;

  if (action === "suggest_bounty") {
    return historyContext + "\ncurrent message: " + current + "\n\n" +
      "they want a bounty idea. respond with ONLY valid JSON, no other text:\n" +
      '{"name":"bounty title, max 50 chars, lowercase, plain words only",' +
      '"description":"2-3 sentences for poidh.xyz: what must be done, what counts as proof, any specific requirements. clear and direct. do NOT mention any ETH amount, reward value, or prize — that is set separately.",' +
      '"reply":"your reply to the user. MUST name the specific bounty idea (e.g. \'how about catching a street performer mid-act\'). briefly mention what proof is needed. end with \'want me to create this on-chain?\'. max 280 chars, no markdown. do NOT mention any ETH amount."}\n\n' +
      'example name: "find a street performer in a major city"\n' +
      'example description: "find a street performer actively performing in a major city. take a photo or short video clearly showing the performer mid-act with a recognizable urban backdrop. proof must be original, unedited, and taken within the last 7 days."\n' +
      'example reply: "how about finding a street performer in action — photo or short vid, clearly mid-performance in a public space. want me to create this on-chain?"';
  }

  if (action === "evaluate_submission") {
    return historyContext + "\ncurrent message: " + current + "\n\n" +
      "they want to know if this counts as valid proof for a poidh bounty. evaluate honestly — is it specific enough, original, recent? say what's missing if it doesn't qualify.";
  }

  if (action === "pick_winner") {
    return historyContext + "\ncurrent message: " + current + "\n\n" +
      "they want help picking a winner from submissions. evaluate each option briefly, pick the best one with a one-sentence reason. if there's not enough info, ask for the submissions.";
  }

  // general_reply — bounty thread or direct reply to bot
  const winnerCtx = bountyContext?.winnerClaimId
    ? "\nthis bounty has already been resolved. " +
      "winning claim id: " + bountyContext.winnerClaimId + ". " +
      (bountyContext.winnerIssuer ? "winner wallet: " + bountyContext.winnerIssuer + ". " : "") +
      (bountyContext.winnerReasoning ? "reason they won: " + bountyContext.winnerReasoning + ". " : "") +
      "if someone asks why this person won, explain based on the reason above. " +
      "if someone challenges the result, defend it based on the bounty requirements and the winning proof. " +
      "be direct and confident — this was picked by an autonomous AI evaluator.\n"
    : "";

  // Build per-claim context — identify who is asking and what claims are being referenced
  const rejectedCtx = (() => {
    const results = bountyContext?.allEvalResults;
    if (!results || results.length === 0) return "";

    const castText = ctx.castText?.toLowerCase() ?? "";
    const authorUsername = ctx.authorUsername?.toLowerCase() ?? "";

    // 1. Is the speaker themselves a submitter?
    const speakerClaim = results.find((r) =>
      (r.issuerUsername && r.issuerUsername.replace("@", "").toLowerCase() === authorUsername) ||
      (r.issuer && r.issuer.toLowerCase() === authorUsername)
    );

    // 2. Is the speaker mentioning a specific claim ID? e.g. "claim #362" or "#362"
    const mentionedClaimId = (() => {
      const m = castText.match(/#(\d+)/) ?? castText.match(/claim\s+(\d+)/);
      return m ? m[1] : null;
    })();
    const mentionedClaim = mentionedClaimId
      ? results.find((r) => r.claimId === mentionedClaimId)
      : null;

    // 3. Is the speaker mentioning another user? e.g. "@dan_xv"
    const mentionedUsername = (() => {
      // strip the bot's own mention first, then grab first remaining @handle
      const stripped = castText.replace(/@poidh[^\s]*/gi, "").replace(/@sentinel[^\s]*/gi, "");
      const m = stripped.match(/@([a-z0-9_.-]+)/i);
      return m ? m[1].toLowerCase() : null;
    })();
    const mentionedUserClaim = mentionedUsername && mentionedUsername !== authorUsername
      ? results.find((r) =>
          r.issuerUsername && r.issuerUsername.replace("@", "").toLowerCase() === mentionedUsername
        )
      : null;

    const parts: string[] = [];

    if (speakerClaim) {
      parts.push(`the person asking (@${ctx.authorUsername}) submitted claim #${speakerClaim.claimId} (score ${speakerClaim.score}/100, valid: ${speakerClaim.valid}): ${speakerClaim.reasoning}. address them directly about their own submission.`);
    }

    if (mentionedClaim && mentionedClaim.claimId !== speakerClaim?.claimId) {
      parts.push(`they are asking about claim #${mentionedClaim.claimId}${mentionedClaim.issuerUsername ? ` (submitted by ${mentionedClaim.issuerUsername})` : ""} — score ${mentionedClaim.score}/100, valid: ${mentionedClaim.valid}: ${mentionedClaim.reasoning}.`);
    }

    if (mentionedUserClaim && mentionedUserClaim.claimId !== mentionedClaim?.claimId) {
      parts.push(`they are asking about @${mentionedUsername}'s claim #${mentionedUserClaim.claimId} — score ${mentionedUserClaim.score}/100, valid: ${mentionedUserClaim.valid}: ${mentionedUserClaim.reasoning}.`);
    }

    // Always include the full results list so the bot can answer any arbitrary question
    const allLines = results
      .map((r) => `claim #${r.claimId}${r.issuerUsername ? ` by ${r.issuerUsername}` : ""} — score ${r.score}/100, valid: ${r.valid}: ${r.reasoning}`)
      .join("; ");
    parts.push(`all evaluated claims: ${allLines}.`);

    return "\n" + parts.join("\n") + "\nuse the above to give specific, accurate answers about any claim or submitter.\n";
  })();

  const bountyCtx = bountyContext
    ? "\nthis is a reply in the announcement thread for the bounty \"" + bountyContext.name +
      "\" on " + bountyContext.chain + ".\nbounty description: " + bountyContext.description +
      (bountyContext.poidhUrl ? "\nbounty link: " + bountyContext.poidhUrl : "") + "\n" +
      winnerCtx + rejectedCtx
    : "";

  const potCtx = livePotContext ? "\nlive contract data: " + livePotContext + "\n" : "";

  return historyContext + bountyCtx + potCtx + "\ncurrent message: " + current + "\n\n" +
    "you are in an active thread. reply naturally, staying on topic with the conversation above. " +
    "do not introduce yourself. do not reset the conversation. answer what was asked directly. " +
    "keep it under 280 chars — one tight thought, no padding. " +
    (livePotContext
      ? "use the live contract data above to answer questions about the bounty pot — do NOT say you can't check or to check poidh.xyz when you already have the live value."
      : "if asked about bounty value or submissions, point to the poidh.xyz link.");
}
