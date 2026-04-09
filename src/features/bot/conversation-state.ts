import "server-only";

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

// Parse chain from user text
export function parseChain(text: string): "arbitrum" | "base" | "degen" | null {
  const lower = text.toLowerCase();
  if (lower.includes("arbitrum") || lower.includes("arb")) return "arbitrum";
  if (lower.includes("base")) return "base";
  if (lower.includes("degen")) return "degen";
  return null;
}

// Parse amount from user text — returns string like "0.005" or "2000"
export function parseAmount(text: string): string | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:eth|degen)?/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (isNaN(val) || val <= 0) return null;
  return val.toString();
}

// Check if text is a clear confirmation — must be unambiguous
// Deliberately conservative: don't match casual filler words like "ok", "great", "perfect"
export function isConfirmation(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Exact short confirmations
  if (lower === "yes" || lower === "y" || lower === "yep" || lower === "yup") return true;
  if (lower === "yeah" || lower === "sure" || lower === "do it") return true;

  // Phrases that clearly signal bounty creation intent
  if (lower.includes("let's go") || lower.includes("lets go")) return true;
  if (lower.includes("go for it")) return true;
  if (lower.includes("create it") || lower.includes("create the bounty")) return true;
  if (lower.includes("deploy it") || lower.includes("deploy the bounty")) return true;
  if (lower.includes("make it") || lower.includes("post it")) return true;
  if (lower.includes("launch it") || lower.includes("launch the bounty")) return true;
  if (lower.includes("i want it") || lower.includes("i'll take it")) return true;
  if (lower.includes("yes please") || lower.includes("yeah please")) return true;
  if (lower.includes("that works") || lower.includes("that's good") || lower.includes("thats good")) return true;
  if (lower.includes("sounds good") && lower.length < 20) return true; // only when it's the whole message
  if (lower.includes("looks good") && lower.length < 20) return true;

  return false;
}

// Check if text is a rejection
export function isRejection(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === "no" ||
    lower === "n" ||
    lower.includes("nope") ||
    lower.includes("nah") ||
    lower.includes("not") ||
    lower.includes("different") ||
    lower.includes("another") ||
    lower.includes("other idea")
  );
}

// Platform fee charged on top of the bounty amount (kept by the bot wallet)
export const PLATFORM_FEE_PCT = 2.5;

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

// Generate a unique amount by adding a tiny suffix (e.g. 0.0010250 → 0.0010251)
// Applied AFTER the fee so the uniqueness suffix is on top of total
export function makeUniqueAmount(baseAmount: string, index: number): string {
  const base = parseFloat(baseAmount);
  const unique = base + (index * 0.0000001);
  return unique.toFixed(7).replace(/0+$/, "").replace(/\.$/, "");
}
