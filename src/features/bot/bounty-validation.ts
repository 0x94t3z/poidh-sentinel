import "server-only";

/**
 * validateRealWorldBounty — reject bounties that are digital-only tasks.
 *
 * poidh is "pics or it didn't happen" — proof must be physical, real-world actions.
 * A bounty asking someone to post a tweet, mint an NFT, or retweet something is
 * trivially gameable and defeats the purpose of the platform.
 *
 * Returns { valid: true } or { valid: false, reason: string }.
 */

interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Signals that a bounty is purely digital — no real-world presence required
const DIGITAL_ONLY_SIGNALS = [
  // social media tasks
  "retweet", "reply to", "like this", "follow us", "subscribe to",
  "join discord", "join telegram", "join our", "dm me", "send a dm",
  "post on twitter", "post on x ", "tweet about", "share on",
  "farcaster cast", "post a cast", "recast", "like a cast",
  // digital creation (no physical evidence)
  "mint an nft", "mint a token", "deploy a contract", "write a smart contract",
  "create a wallet", "sign up for", "register on", "create an account",
  // trivially unverifiable online actions
  "visit a website", "click on", "fill out a form", "submit a form",
  "solve a captcha", "vote in a poll",
];

// Signals that strongly suggest real-world physical activity
const REAL_WORLD_SIGNALS = [
  "photo", "photograph", "picture", "pic", "image",
  "video", "footage", "film", "record",
  "in person", "physically", "irl", "in real life",
  "outside", "outdoors", "public", "street", "park", "city",
  "location", "place", "spot",
  "hold", "wear", "carry", "stand next to", "touch",
  "show yourself", "selfie", "face",
  "handwritten", "written note", "sign",
  "buy", "purchase", "receipt", "store",
  "eat", "drink", "food", "restaurant",
];

export function validateRealWorldBounty(
  name: string,
  description: string,
): ValidationResult {
  const combined = `${name} ${description}`.toLowerCase();

  // Hard reject: clearly digital-only
  for (const signal of DIGITAL_ONLY_SIGNALS) {
    if (combined.includes(signal)) {
      return {
        valid: false,
        reason: `bounty looks digital-only ("${signal}") — poidh requires real-world photo/video proof`,
      };
    }
  }

  // Soft check: needs at least one real-world signal
  const hasRealWorldSignal = REAL_WORLD_SIGNALS.some((s) => combined.includes(s));
  if (!hasRealWorldSignal) {
    return {
      valid: false,
      reason:
        "bounty description doesn't mention photo, video, or any real-world activity — poidh requires physical proof",
    };
  }

  return { valid: true };
}
