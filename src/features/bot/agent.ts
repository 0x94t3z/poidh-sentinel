import "server-only";
import type { AgentContext, AgentResponse, BountyAction } from "@/features/bot/types";
import { fetchCastThread } from "@/features/bot/cast-reply";
import { getBountyDetails } from "@/features/bot/poidh-contract";
import { getActiveBounties } from "@/features/bot/bounty-store";
import { formatEther } from "viem";
import { validateRealWorldBounty } from "@/features/bot/bounty-validation";

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

const SYSTEM_PROMPT = `you are poidh-sentinel, an autonomous bounty agent for the poidh (pics or it didn't happen) platform on farcaster.

poidh is an on-chain bounty protocol on arbitrum, base, and degen chain. users create open bounties with ETH or DEGEN, anyone can submit proof (photo/video), and the community votes on the winner. bounties are for real-world tasks only — no digital-only submissions.

your personality:
- direct, witty, lowercase always
- sound like a person not a bot
- concise — farcaster has a 320 char limit, stay well under it
- never use markdown, no bullet points, no bold, no headers
- never say "as an ai", "i'm an ai", "i cannot", or any disclaimer
- never start with "i'd love to", "great question", "sure!", or similar filler
- NEVER introduce yourself mid-conversation ("i'm poidh-sentinel..." is banned unless someone literally asks who you are)
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
- winner selection for open bounties with external contributors is a 2-step process:
  1. the bot nominates the best submission via submitClaimForVote (starts a 48h voting window)
  2. after 48h, anyone can call resolveVote — claim wins if YES votes exceed 50% of contributor weight
- if no external contributors, the bot can accept a claim directly with no voting required
- proof must be original, recent, unedited photos or videos submitted on poidh.xyz
- bounty link format: poidh.xyz/{chain}/bounty/{id}
- do NOT invent rules beyond what's above — if unsure, say "check poidh.xyz for details"
- ALWAYS call bounties "open bounties" — NEVER use the word "single" to describe a bounty type. poidh only creates open bounties.`;

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
    if (ctx.bountyContext?.bountyId && !ctx.bountyContext.bountyId.startsWith("pending-")) {
      console.log(
        `[agent] resolveActiveBounty: using thread bountyId=${ctx.bountyContext.bountyId} chain=${ctx.bountyContext.chain}`,
      );
      return { bountyId: ctx.bountyContext.bountyId, chain: ctx.bountyContext.chain };
    }

    const all = await getActiveBounties(); // already ordered newest first
    const open = all.filter((b) => !b.bountyId.startsWith("pending-"));

    if (ctx.bountyContext) {
      // Prefer exact name match in same chain
      const match = open.find((b) => b.name === ctx.bountyContext!.name && b.chain === ctx.bountyContext!.chain);
      if (match) {
        console.log(`[agent] resolveActiveBounty: matched by name — bountyId=${match.bountyId} chain=${match.chain}`);
        return { bountyId: match.bountyId, chain: match.chain };
      }
      // Fuzzy: same chain, any open bounty
      const chainMatch = open.find((b) => b.chain === ctx.bountyContext!.chain);
      if (chainMatch) {
        console.log(`[agent] resolveActiveBounty: matched by chain — bountyId=${chainMatch.bountyId} chain=${chainMatch.chain}`);
        return { bountyId: chainMatch.bountyId, chain: chainMatch.chain };
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

function detectAction(text: string): BountyAction {
  const lower = text.toLowerCase();

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

  // Broad suggest_bounty detection — catches "any ideas", "bounty idea", "what bounty", etc.
  if (
    lower.includes("suggest") ||
    lower.includes("idea") ||
    lower.includes("what bounty") ||
    lower.includes("bounty idea") ||
    lower.includes("give me a bounty") ||
    lower.includes("create a bounty") ||
    lower.includes("make a bounty") ||
    lower.includes("draft a bounty") ||
    lower.includes("what should") ||
    lower.includes("come up with") ||
    lower.includes("any bounty") ||
    lower.includes("bounty for") ||
    lower.includes("good bounty") ||
    lower.includes("cool bounty") ||
    lower.includes("fun bounty") ||
    lower.includes("new bounty")
  ) {
    return "suggest_bounty";
  }

  return "general_reply";
}

async function callLLM(
  messages: Array<{ role: string; content: string }>,
  modelIndex = 0,
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
        body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.7 }),
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
        return callLLM(messages, modelIndex + 1);
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
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", messages, max_tokens: 300, temperature: 0.7 }),
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
  return callOpenRouter(messages, orIndex);
}

async function callOpenRouter(
  messages: Array<{ role: string; content: string }>,
  modelIndex = 0,
): Promise<string> {
  const model = OPENROUTER_MODELS[modelIndex] ?? OPENROUTER_MODELS[0];
  const apiKey = process.env.OPENROUTER_API_KEY!;

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://poidh-sentinel.neynar.app",
      "X-Title": "poidh-sentinel",
    },
    body: JSON.stringify({ model, messages, max_tokens: 300, temperature: 0.7 }),
  });

  if (!response.ok) {
    if (modelIndex < OPENROUTER_MODELS.length - 1) {
      console.warn(`[agent] openrouter/${model} failed (${response.status}), trying next...`);
      return callOpenRouter(messages, modelIndex + 1);
    }
    const errorText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    if (modelIndex < OPENROUTER_MODELS.length - 1) {
      console.warn(`[agent] openrouter/${model} returned empty, trying next...`);
      return callOpenRouter(messages, modelIndex + 1);
    }
    throw new Error("All models exhausted — no content returned");
  }

  console.log(`[agent] openrouter/${model} responded`);
  return content;
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
  // If we're in a bounty thread OR this is a direct reply to the bot's cast,
  // skip keyword detection entirely — just have a natural conversation.
  // Prevents "good bounty idea!" from triggering a new suggest_bounty flow.
  const inContext = !!(ctx.bountyContext ?? ctx.replyToBot);
  const action = inContext ? "general_reply" : detectAction(ctx.castText);

  // Wallet address — no LLM needed
  if (action === "wallet_address") {
    const address = process.env.BOT_WALLET_ADDRESS ?? process.env.NEYNAR_WALLET_ADDRESS ?? "not configured";
    const reply = address === "not configured"
      ? "wallet not configured yet — check back soon."
      : `send ETH to ${address} on arbitrum or base. minimum 0.001 ETH. once funded i'll deploy the bounty and anyone can add more.`;
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

  const raw = await callLLM(messages);

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

    // Plain text fallback — LLM didn't return JSON, use the raw reply anyway
    // Still create a suggestedIdea so the conversation flow can continue
    const plain = stripMarkdown(raw).slice(0, 320);
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
      '"reply":"your reply to the user. suggest the idea briefly, mention what proof is needed. end by asking if they want you to create it on-chain. max 280 chars, no markdown. do NOT mention any ETH amount."}\n\n' +
      'example name: "find a street performer in a major city"\n' +
      'example description: "find a street performer actively performing in a major city. take a photo or short video clearly showing the performer mid-act with a recognizable urban backdrop. proof must be original, unedited, and taken within the last 7 days."\n' +
      'example reply: "how about finding a street performer in action — photo or short vid, clearly mid-performance in a public space. want me to post this as a bounty on-chain?"';
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

  const bountyCtx = bountyContext
    ? "\nthis is a reply in the announcement thread for the bounty \"" + bountyContext.name +
      "\" on " + bountyContext.chain + "." +
      (bountyContext.bountyId ? "\nraw bounty id: " + bountyContext.bountyId : "") +
      "\nbounty description: " + bountyContext.description +
      (bountyContext.poidhUrl ? "\nbounty link: " + bountyContext.poidhUrl : "") + "\n" +
      winnerCtx
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
