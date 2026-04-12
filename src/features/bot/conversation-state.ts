import "server-only";
import { PLATFORM_FEE_PCT } from "@/features/bot/constants";

// Re-export everything from DB actions so existing imports keep working
export type { ConversationState, ConversationStep } from "@/db/actions/bot-actions";
export {
  getConversation,
  setConversation,
  clearConversation,
} from "@/db/actions/bot-actions";

// Chain config: min amounts and labels
export const CHAIN_CONFIG = {
  arbitrum: {
    minAmount: "0.001",
    currency: "ETH",
    label: "Arbitrum",
    explorer: "arbiscan.io",
  },
  base: {
    minAmount: "0.001",
    currency: "ETH",
    label: "Base",
    explorer: "basescan.org",
  },
  degen: {
    minAmount: "1000",
    currency: "DEGEN",
    label: "Degen Chain",
    explorer: "explorer.degen.tips",
  },
} as const;

// Shared LLM caller for intent parsing — uses the smallest/fastest model available.
// Returns the raw text response or null on failure.
async function askLLM(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const apiKey = process.env.CEREBRAS_API_KEY ?? process.env.GROQ_API_KEY ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) return null;
    const endpoint = process.env.CEREBRAS_API_KEY
      ? "https://api.cerebras.ai/v1/chat/completions"
      : process.env.GROQ_API_KEY
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
    const model = process.env.CEREBRAS_API_KEY
      ? "llama3.1-8b"
      : process.env.GROQ_API_KEY
      ? "llama-3.1-8b-instant"
      : "meta-llama/llama-3.3-70b-instruct:free";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        max_tokens: 20,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

// Parse chain from user text — keyword-first, LLM fallback for ambiguous phrasing
export async function parseChain(text: string): Promise<"arbitrum" | "base" | "degen" | null> {
  const lower = text.toLowerCase();
  if (lower.includes("arbitrum") || lower.includes("arb")) return "arbitrum";
  if (lower.includes("base")) return "base";
  if (lower.includes("degen")) return "degen";
  // LLM fallback — handles "the ethereum one", "cheap chain", etc.
  const answer = await askLLM(
    "Extract which blockchain the user wants to use. Reply with only one word: arbitrum, base, degen, or none.",
    `Message: "${text}"\n\nWhich chain? Reply: arbitrum, base, degen, or none.`,
  );
  if (!answer) return null;
  const a = answer.toLowerCase().trim();
  if (a.includes("arbitrum")) return "arbitrum";
  if (a.includes("base")) return "base";
  if (a.includes("degen")) return "degen";
  return null;
}

// Parse amount from user text — regex-first, LLM fallback for written numbers
export async function parseAmount(text: string): Promise<string | null> {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:eth|degen)?/i);
  if (match) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val.toString();
  }
  // LLM fallback — handles "half an ETH", "a thousand DEGEN", etc.
  const answer = await askLLM(
    "Extract the numeric amount from the message. Reply with only the number (e.g. 0.5, 1000) or none.",
    `Message: "${text}"\n\nWhat amount? Reply with just the number or none.`,
  );
  if (!answer) return null;
  const val = parseFloat(answer.trim());
  if (!isNaN(val) && val > 0) return val.toString();
  return null;
}

// Check if text is a clear confirmation using an LLM — handles any language, case, or phrasing.
// Falls back to a simple keyword check if no LLM key is available.
export async function isConfirmation(text: string): Promise<boolean> {
  // Fast keyword pre-check — catches obvious cases without an LLM call
  const lower = text.toLowerCase().trim();
  const obviousYes =
    /^(yes|yeah|yep|yup|y|sure|do it|lfg|wagmi|w|pls|plz|please)[\s!,.]?$/.test(lower) ||
    lower.startsWith("yes,") || lower.startsWith("yes ") || lower.startsWith("yes!") ||
    lower.startsWith("yeah,") || lower.startsWith("yeah ") || lower.startsWith("yeah!") ||
    lower.startsWith("sure,") || lower.startsWith("sure ") || lower.startsWith("sure!") ||
    lower.includes("let's do") || lower.includes("lets do") ||
    lower.includes("let's go") || lower.includes("lets go") ||
    lower.includes("go for it") || lower.includes("create it") ||
    lower.includes("make it") || lower.includes("post it") || lower.includes("deploy it");
  if (obviousYes) return true;

  // Obvious rejections — skip LLM call entirely
  const obviousNo =
    /^(no|n|nope|nah)[\s!,.]?$/.test(lower) ||
    lower.startsWith("no,") || lower.startsWith("no ") ||
    lower.includes("don't") || lower.includes("do not") || lower.includes("cancel");
  if (obviousNo) return false;

  // Ambiguous — ask the LLM
  try {
    const apiKey = process.env.CEREBRAS_API_KEY ?? process.env.GROQ_API_KEY ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) return false;

    const endpoint = process.env.CEREBRAS_API_KEY
      ? "https://api.cerebras.ai/v1/chat/completions"
      : process.env.GROQ_API_KEY
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
    const model = process.env.CEREBRAS_API_KEY
      ? "llama3.1-8b"
      : process.env.GROQ_API_KEY
      ? "llama-3.1-8b-instant"
      : "meta-llama/llama-3.3-70b-instruct:free";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: "You decide if a message is agreeing to proceed with creating a bounty. Reply with only YES or NO.",
          },
          {
            role: "user",
            content: `Message: "${text}"\n\nIs this person agreeing to proceed? YES or NO only.`,
          },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase() ?? "";
    return answer.startsWith("YES");
  } catch {
    return false;
  }
}

// Parse bounty type — keyword-first, LLM fallback for natural phrasing
export async function parseBountyType(text: string): Promise<"open" | "solo" | null> {
  const lower = text.toLowerCase().trim();
  if (lower.includes("solo") || lower.includes("just me") || lower.includes("i decide") || lower.includes("myself")) return "solo";
  if (lower.includes("open") || lower.includes("community") || lower.includes("vote") || lower.includes("crowdfund") || lower.includes("anyone")) return "open";
  if (lower === "open" || lower === "o") return "open";
  if (lower === "solo" || lower === "s") return "solo";
  // LLM fallback — handles "I want to pick the winner myself", "let the crowd decide", etc.
  const answer = await askLLM(
    "Determine if the user wants an open bounty (community votes on winner) or a solo bounty (creator picks winner). Reply with only: open, solo, or unclear.",
    `Message: "${text}"\n\nBounty type? Reply: open, solo, or unclear.`,
  );
  if (!answer) return null;
  const a = answer.toLowerCase().trim();
  if (a.includes("solo")) return "solo";
  if (a.includes("open")) return "open";
  return null;
}

// Check if text is a rejection — keyword-first, LLM fallback
export async function isRejection(text: string): Promise<boolean> {
  const lower = text.toLowerCase().trim();
  const obviousYes =
    /^(yes|yeah|yep|yup|y|sure|do it|lfg|wagmi|w|pls|plz|please)[\s!,.]?$/.test(lower) ||
    lower.startsWith("yes,") || lower.startsWith("yes ") || lower.startsWith("yes!") ||
    lower.startsWith("yeah,") || lower.startsWith("yeah ") || lower.startsWith("yeah!") ||
    lower.startsWith("sure,") || lower.startsWith("sure ") || lower.startsWith("sure!");
  if (obviousYes) return false;

  if (/^(no|n|nope|nah)[\s!,.]?$/.test(lower)) return true;
  if (lower.startsWith("no,") || lower.startsWith("no ") || lower.startsWith("no!")) return true;
  if (lower.includes("different") || lower.includes("another idea") || lower.includes("other idea")) return true;
  if (lower.includes("don't want") || lower.includes("do not want") || lower.includes("not interested")) return true;
  // LLM fallback — handles "nah not feeling it", "skip this one", etc.
  const answer = await askLLM(
    "Is this person declining or rejecting a proposal? Reply with only YES or NO.",
    `Message: "${text}"\n\nAre they declining? YES or NO only.`,
  );
  return (answer?.trim().toUpperCase() ?? "NO").startsWith("YES");
}

// Re-export from constants so existing imports remain stable.
export { PLATFORM_FEE_PCT };

// Returns total amount user must send = bountyAmount + platform fee
// e.g. bountyAmount=0.001, fee=2.5% → total=0.0010250
export function addPlatformFee(bountyAmount: string): { total: string; fee: string } {
  const base = parseFloat(bountyAmount);
  const fee = base * (PLATFORM_FEE_PCT / 100);
  const total = base + fee;
  // Round to 7 decimal places to avoid floating point noise
  const feeStr = fee.toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
  const totalStr = total.toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
  return { total: totalStr, fee: feeStr };
}

// Generate a unique amount by adding a tiny suffix to avoid deposit collisions.
// ETH amounts (e.g. 0.001025): suffix = index * 0.0000001 → 0.0010251, 0.0010252 ...
// DEGEN amounts (e.g. 1025):   suffix = index * 0.001     → 1025.001, 1025.002 ...
// Applied AFTER the fee so the uniqueness suffix is on top of total.
export function makeUniqueAmount(baseAmount: string, index: number, isDegen = false): string {
  const base = parseFloat(baseAmount);
  const step = isDegen ? 0.001 : 0.0000001;
  const unique = base + (index * step);
  const decimals = isDegen ? 3 : 7;
  return unique.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "");
}
