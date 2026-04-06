import { getEnv } from "../config.js";

export type DecisionPost = {
  bountyId: bigint;
  bountyTitle: string;
  winningClaimId: bigint;
  reason: string;
  url?: string;
};

export type FarcasterCastDraft = {
  text: string;
  embeds: Array<{ url: string }>;
  author?: string;
  parentUrl?: string;
};

export type SocialTarget = "farcaster";

export type AssistantIntent =
  | "suggest_bounty"
  | "evaluate_submission"
  | "pick_winner"
  | "general_reply"
  | "create_bounty";

export type DecisionRelayEnvelope = {
  targets: SocialTarget[];
  message: string;
  castDraft: FarcasterCastDraft;
  decision: DecisionPost;
  followUpAnswers: Array<{
    question: string;
    answer: string;
  }>;
};

type LlmMessage = {
  role: string;
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_CEREBRAS_MODELS = ["llama-3.3-70b", "llama3.1-8b"];
const DEFAULT_OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "openai/gpt-oss-20b:free",
  "stepfun/step-3.5-flash:free",
  "arcee-ai/trinity-mini:free",
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text: string): string[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return [];
  }
  return normalized
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function isLowSignalSentence(sentence: string): boolean {
  return (
    /^(ai:|okay, let'?s tackle|first,? i need|the user wants me|the main goal|the prompt says)/i.test(
      sentence
    ) ||
    /\b(let'?s tackle|first,? i need|the user wants me|main goal|prompt says|as an ai)\b/i.test(sentence)
  );
}

export function summarizeReasonForSocial(reason: string, maxLength = 320): string {
  const cleaned = reason
    .replace(/\bAI:\s*/gi, "")
    .replace(/\bAI evaluation confirmed this claim as valid for the task\.?/gi, "")
    .replace(/\bAI accepted this claim despite strict deterministic signal mismatch\.?/gi, "");
  const concise = splitSentences(cleaned).filter((sentence) => !isLowSignalSentence(sentence));
  const selected = concise.slice(0, 3).join(" ");
  const fallback = normalizeWhitespace(cleaned);
  const finalText = normalizeWhitespace(selected || fallback);
  if (finalText.length <= maxLength) {
    return finalText;
  }
  return `${finalText.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function parseSocialTargets(): SocialTarget[] {
  return ["farcaster"];
}

export function classifyAssistantIntent(question: string): AssistantIntent {
  const normalizedQuestion = normalizeQuestion(question);

  if (
    normalizedQuestion.includes("create") ||
    normalizedQuestion.includes("make bounty") ||
    normalizedQuestion.includes("post bounty")
  ) {
    return "create_bounty";
  }

  if (
    normalizedQuestion.includes("evaluate") ||
    normalizedQuestion.includes("review") ||
    normalizedQuestion.includes("submit") ||
    normalizedQuestion.includes("proof") ||
    normalizedQuestion.includes("claim") ||
    normalizedQuestion.includes("valid")
  ) {
    return "evaluate_submission";
  }

  if (
    normalizedQuestion.includes("winner") ||
    normalizedQuestion.includes("who should win") ||
    normalizedQuestion.includes("finalize") ||
    normalizedQuestion.includes("finalise") ||
    normalizedQuestion.includes("accepted") ||
    normalizedQuestion.includes("select") ||
    normalizedQuestion.includes("choose")
  ) {
    return "pick_winner";
  }

  if (
    normalizedQuestion.includes("idea") ||
    normalizedQuestion.includes("open bounty") ||
    normalizedQuestion.includes("crowdfund")
  ) {
    return "suggest_bounty";
  }

  return "general_reply";
}

function assistantIntentLabel(intent: AssistantIntent): string {
  switch (intent) {
    case "suggest_bounty":
      return "suggest a bounty idea";
    case "evaluate_submission":
      return "evaluate a submission";
    case "pick_winner":
      return "pick a winner";
    case "create_bounty":
      return "create a bounty";
    default:
      return "general reply";
  }
}

function stringifyThreadContext(threadContext: string): string {
  return threadContext
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 8)
    .join("\n");
}

const ASSISTANT_SYSTEM_PROMPT = `you are poidh-sentinel, an autonomous bounty agent for poidh (pics or it didn't happen) on farcaster.

poidh is an on-chain bounty protocol — users create open bounties, anyone can submit proof, and the community votes on the winner. bounties require real-world actions: photos, videos, and physical tasks.

your job:
- chat with users to help them come up with creative, specific bounty ideas
- when asked to create a bounty, confirm the idea and say you'll deploy it on-chain
- if someone wants to fund a bounty, give them the bot's wallet address so they can send ETH
- evaluate cast submissions against a bounty and give honest verdicts
- pick winners with clear reasoning
- explain how poidh works when asked

rules:
- always be helpful, direct, and lowercase
- sound human, not robotic
- keep replies concise and finish your thought
- never use markdown — no bold, no italic, no bullet dashes, no headers — plain text only
- never say "as an ai" or include chatbot disclaimers
- when someone asks for a bounty idea, suggest one specific, fun, real-world idea
- when someone asks to create, deploy, launch, or make a bounty live, say you're doing it and it'll be live shortly
- when someone asks about funding, give them the wallet address and say they can send ETH on arbitrum or base
- open bounties are crowdfunded — multiple people can contribute and the winner is voted on by contributors`;

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    ordered.push(trimmed);
  }
  return ordered;
}

function getCerebrasModels(): string[] {
  return uniqueValues([...DEFAULT_CEREBRAS_MODELS]);
}

function getOpenRouterModels(): string[] {
  return uniqueValues([...DEFAULT_OPENROUTER_MODELS]);
}

async function postChatCompletion(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  options: {
    maxTokens: number;
    temperature: number;
    headers?: Record<string, string>;
  }
): Promise<string | undefined> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...options.headers
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${apiUrl} ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = payload.choices?.[0]?.message?.content?.trim();
  return content && content.length > 0 ? content : undefined;
}

async function callCerebras(
  messages: LlmMessage[],
  options: {
    maxTokens: number;
    temperature: number;
  }
): Promise<string | undefined> {
  const apiKey = getEnv("CEREBRAS_API_KEY", "");
  if (!apiKey) {
    return undefined;
  }

  for (const model of getCerebrasModels()) {
    try {
      const content = await postChatCompletion(CEREBRAS_API_URL, apiKey, model, messages, options);
      if (content) {
        console.log(`[agent] cerebras/${model} responded`);
        return content;
      }
      console.warn(`[agent] cerebras/${model} returned empty, trying next...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[agent] cerebras/${model} failed (${message}), trying next...`);
    }
  }

  return undefined;
}

async function callOpenRouter(
  messages: LlmMessage[],
  options: {
    maxTokens: number;
    temperature: number;
  }
): Promise<string | undefined> {
  const apiKey = getEnv("OPENROUTER_API_KEY", "");
  if (!apiKey) {
    return undefined;
  }

  for (const model of getOpenRouterModels()) {
    try {
      const content = await postChatCompletion(OPENROUTER_API_URL, apiKey, model, messages, {
        ...options,
        headers: {
          "HTTP-Referer": "https://poidh-sentinel.neynar.app",
          "X-Title": "poidh-sentinel"
        }
      });
      if (content) {
        console.log(`[agent] openrouter/${model} responded`);
        return content;
      }
      console.warn(`[agent] openrouter/${model} returned empty, trying next...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[agent] openrouter/${model} failed (${message}), trying next...`);
    }
  }

  return undefined;
}

async function callAssistantModel(
  messages: LlmMessage[],
  options: {
    maxTokens: number;
    temperature: number;
  }
): Promise<string | undefined> {
  const cerebrasReply = await callCerebras(messages, options);
  if (cerebrasReply) {
    return cerebrasReply;
  }

  return callOpenRouter(messages, options);
}

export async function fetchCastThreadContext(castHash: string): Promise<string | undefined> {
  const apiKey = getEnv("NEYNAR_API_KEY", "");
  const trimmedHash = castHash.trim();
  if (!apiKey || !trimmedHash) {
    return undefined;
  }

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${encodeURIComponent(trimmedHash)}&type=hash&reply_depth=2&include_chronological_parent_casts=true&limit=10`,
      {
        headers: {
          "x-api-key": apiKey
        }
      }
    );
    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as {
      conversation?: {
        cast?: {
          text?: string;
          author?: { username?: string };
          direct_replies?: Array<{ text?: string; author?: { username?: string } }>;
          chronological_parent_casts?: Array<{ text?: string; author?: { username?: string } }>;
          parent_casts?: Array<{ text?: string; author?: { username?: string } }>;
          chronological_replies?: Array<{ text?: string; author?: { username?: string } }>;
        };
      };
    };

    const cast = payload.conversation?.cast;
    if (!cast) {
      return undefined;
    }

    const lines: string[] = [];
    const pushLine = (username: string | undefined, text: string | undefined) => {
      const cleanedText = text?.trim().replace(/\s+/g, " ");
      if (!cleanedText) {
        return;
      }
      const prefix = username?.trim() ? `@${username.trim()}: ` : "";
      lines.push(`${prefix}${cleanedText}`);
    };

    pushLine(cast.author?.username, cast.text);
    for (const item of cast.chronological_parent_casts ?? cast.parent_casts ?? []) {
      pushLine(item.author?.username, item.text);
    }
    for (const item of cast.direct_replies ?? cast.chronological_replies ?? []) {
      pushLine(item.author?.username, item.text);
    }

    const context = stringifyThreadContext(lines.join("\n"));
    return context.length > 0 ? context : undefined;
  } catch {
    return undefined;
  }
}

export function buildDecisionMessage(post: DecisionPost, author?: string): string {
  return [
    author ? `by ${author}` : undefined,
    `🏁 Poidh decision`,
    `Bounty: ${post.bountyTitle}`,
    `Winner: claim ${post.winningClaimId.toString()}`,
    post.url ? `View bounty: ${post.url}` : undefined,
    `Details in thread ↓`
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDecisionReply(
  post: DecisionPost,
  reason: string,
  author?: string,
  followUpAnswers: Array<{
    question: string;
    answer: string;
  }> = buildFollowUpAnswers(reason)
): string {
  const evidence = "tokenURI, metadata, and content type";
  const autonomy = followUpAnswers[2]?.answer ?? "The winner was selected automatically.";

  return [
    author ? `by ${author}` : undefined,
    `Claim ${post.winningClaimId.toString()} won because it best matched the prompt and had image proof.`,
    `I checked ${evidence}. ${autonomy}`,
    post.url ? `• Bounty: ${post.url}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
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

export async function polishDecisionCopy(
  post: DecisionPost,
  followUpAnswers: Array<{
    question: string;
    answer: string;
  }> = buildFollowUpAnswers(post.reason),
  author?: string
): Promise<{ main: string; reply: string } | undefined> {
  const aiReply = await callAssistantModel(
    [
      {
        role: "system",
        content:
          "You write concise, friendly Farcaster casts. Return only strict JSON with keys main and reply. Keep main under 200 characters and reply under 220 characters. Use a natural Farcaster tone. Do not repeat the reason verbatim. Do not add markdown fences."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            author,
            bountyTitle: post.bountyTitle,
            winningClaimId: post.winningClaimId.toString(),
            bountyUrl: post.url,
            reason: post.reason,
            followUpAnswers
          },
          null,
          2
        )
      }
    ],
    { temperature: 0.2, maxTokens: 180 }
  );

  if (!aiReply) {
    return undefined;
  }

  const rawText = aiReply.trim();
  if (!rawText) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(stripJsonEnvelope(rawText)) as Partial<{ main: string; reply: string }>;
    if (typeof parsed.main === "string" && typeof parsed.reply === "string") {
      const main = parsed.main.trim();
      const reply = parsed.reply.trim();
      if (main.length > 220 || reply.length > 260) {
        return undefined;
      }
      return {
        main,
        reply
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export async function generateAssistantReply(
  question: string,
  context: {
    botHandle: string;
    botWalletAddress?: string;
    minBountyEth?: string;
    mentionsEnabled?: boolean;
    freeTierMode?: boolean;
    intent?: AssistantIntent;
    threadContext?: string;
  }
): Promise<string | undefined> {
  const rawText = await callAssistantModel(
    [
      {
        role: "system",
        content: `${ASSISTANT_SYSTEM_PROMPT}

current intent: ${assistantIntentLabel(context.intent ?? classifyAssistantIntent(question))}

if thread context is provided, use it to answer the user's question precisely.
if they ask how to chat, mention the thread reply or mention flow.
if they ask about funding, give the bot wallet address if available.
return plain text only.`
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            botHandle: context.botHandle,
            botWalletAddress: context.botWalletAddress,
            minBountyEth: context.minBountyEth ?? "0.001",
            mentionsEnabled: context.mentionsEnabled ?? false,
            freeTierMode: context.freeTierMode ?? false,
            intent: context.intent ?? classifyAssistantIntent(question),
            threadContext: context.threadContext ?? undefined,
            question
          },
          null,
          2
        )
      }
    ],
    { temperature: 0.3, maxTokens: 220 }
  );

  return rawText?.length ? rawText : undefined;
}

export function buildFollowUpAnswers(reason: string) {
  const conciseReason = summarizeReasonForSocial(reason, 300);
  return [
    {
      question: "Why did this claim win?",
      answer: conciseReason
    },
    {
      question: "What evidence did the bot check?",
      answer: "It checked the claim tokenURI, claim metadata, resolved content type, and the submission text."
    },
    {
      question: "Was the winner chosen automatically?",
      answer:
        "Yes. The winner is selected automatically using deterministic scoring with optional AI evidence checks."
    }
  ];
}

export function answerFollowUpQuestion(
  question: string,
  context: {
    reason: string;
    finalActionTxHash?: string;
    botWalletAddress?: string;
    mentionsEnabled?: boolean;
    freeTierMode?: boolean;
  },
  knownAnswers: Array<{
    question: string;
    answer: string;
  }> = buildFollowUpAnswers(context.reason)
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const conciseReason = summarizeReasonForSocial(context.reason, 280);
  const isAcceptedOnChain =
    Boolean(context.finalActionTxHash) ||
    /\b(already accepted on-chain|claim is already accepted on-chain|resolved vote|accepted claim)\b/i.test(
      context.reason
    );

  for (const item of knownAnswers) {
    const normalizedKnownQuestion = normalizeQuestion(item.question);
    if (
      normalizedQuestion === normalizedKnownQuestion ||
      normalizedQuestion.includes(normalizedKnownQuestion) ||
      normalizedKnownQuestion.includes(normalizedQuestion)
    ) {
      return item.answer;
    }
  }

  if (
    normalizedQuestion.includes("finalized") ||
    normalizedQuestion.includes("finalised") ||
    normalizedQuestion.includes("confirm") ||
    normalizedQuestion.includes("winner is") ||
    normalizedQuestion.includes("accepted")
  ) {
    if (context.finalActionTxHash) {
      return `Yes. It is finalized on-chain in transaction ${context.finalActionTxHash}.`;
    }
    if (isAcceptedOnChain) {
      return "Yes. The winner is already accepted on-chain.";
    }
    return "The winner is selected; final on-chain action is tracked once the transaction completes.";
  }

  if (
    normalizedQuestion.includes("why") ||
    normalizedQuestion.includes("win") ||
    normalizedQuestion.includes("selected")
  ) {
    return conciseReason;
  }

  if (
    normalizedQuestion.includes("evidence") ||
    normalizedQuestion.includes("proof") ||
    normalizedQuestion.includes("check")
  ) {
    return "It checked the claim tokenURI, claim metadata, resolved content type, and the submission text.";
  }

  if (
    normalizedQuestion.includes("automatic") ||
    normalizedQuestion.includes("deterministic") ||
    normalizedQuestion.includes("ai") ||
    normalizedQuestion.includes("decision")
  ) {
    return "Yes. The winner is selected automatically using deterministic scoring with optional AI evidence checks.";
  }

  if (
    normalizedQuestion.includes("payout") ||
    normalizedQuestion.includes("on chain") ||
    normalizedQuestion.includes("accept claim") ||
    normalizedQuestion.includes("resolve")
  ) {
    if (context.finalActionTxHash) {
      return `Yes. The on-chain final action was recorded in transaction ${context.finalActionTxHash}.`;
    }

    return "The bot resolves the bounty on-chain with acceptClaim for solo bounties or the vote flow for open bounties, and the final transaction is recorded once it completes.";
  }

  if (
    normalizedQuestion.includes("open bounty") ||
    normalizedQuestion.includes("crowdfund") ||
    normalizedQuestion.includes("idea") ||
    normalizedQuestion.includes("wallet") ||
    normalizedQuestion.includes("address") ||
    normalizedQuestion.includes("fund") ||
    normalizedQuestion.includes("chat") ||
    normalizedQuestion.includes("talk") ||
    normalizedQuestion.includes("create bounty")
  ) {
    return answerAssistantQuestion(question, {
      botWalletAddress: context.botWalletAddress,
      mentionsEnabled: context.mentionsEnabled ?? false,
      freeTierMode: context.freeTierMode ?? false
    });
  }

  return `The bot selected the highest-scoring valid claim using deterministic scoring with optional AI evidence checks. ${conciseReason}`;
}

export function answerAssistantQuestion(
  question: string,
  context: {
    botWalletAddress?: string;
    mentionsEnabled?: boolean;
    freeTierMode?: boolean;
    minBountyEth?: string;
    intent?: AssistantIntent;
  } = {}
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const intent = context.intent ?? classifyAssistantIntent(question);
  const minBountyEth = context.minBountyEth ?? "0.001";

  if (intent === "suggest_bounty") {
    return "good open bounty idea: upload a clear outdoor photo of a handwritten note with today’s full date, your username, and `poidh`, then keep it open for at least 2 participants before finalizing.";
  }

  if (
    intent === "evaluate_submission" ||
    normalizedQuestion.includes("evaluate") ||
    normalizedQuestion.includes("review") ||
    normalizedQuestion.includes("submit") ||
    normalizedQuestion.includes("proof") ||
    normalizedQuestion.includes("claim")
  ) {
    return "send the claim text, the proof link, and the bounty prompt, and i can help judge it against the requirements.";
  }

  if (
    intent === "pick_winner" ||
    normalizedQuestion.includes("winner") ||
    normalizedQuestion.includes("finalize") ||
    normalizedQuestion.includes("finalise") ||
    normalizedQuestion.includes("accepted") ||
    normalizedQuestion.includes("choose")
  ) {
    return "once the submissions are in, i can pick the highest-scoring valid claim, explain why it won, and post the reasoning in-thread.";
  }

  if (
    intent === "general_reply" &&
    (normalizedQuestion.includes("chat") ||
      normalizedQuestion.includes("talk") ||
      normalizedQuestion.includes("best way"))
  ) {
    if (context.mentionsEnabled) {
      return "you can mention the bot in-thread and it can reply there. if needed, you can also use relay follow-up for manual fallback.";
    }
    if (context.freeTierMode) {
      return "right now the stable path is thread replies / relay follow-up. direct mention webhook chat is limited on free tier, so i keep replies in-thread for reliability.";
    }
    return "best path right now is in-thread replies (or relay follow-up) so decisions and reasoning stay public and auditable.";
  }

  if (
    intent === "general_reply" &&
    (normalizedQuestion.includes("wallet") ||
      normalizedQuestion.includes("fund") ||
      normalizedQuestion.includes("address"))
  ) {
    if (context.botWalletAddress) {
      return `funding wallet: ${context.botWalletAddress}. send at least ${minBountyEth} ETH plus gas buffer, then i can create an open bounty from that wallet.`;
    }
    return "funding wallet is not configured yet. once BOT_PRIVATE_KEY is set, i can share the exact funding address.";
  }

  if (
    intent === "create_bounty" ||
    normalizedQuestion.includes("create") ||
    normalizedQuestion.includes("make bounty") ||
    normalizedQuestion.includes("post bounty")
  ) {
    return `send the goal + title + prompt + reward (min ${minBountyEth} ETH), and i can create an open bounty flow from that request.`;
  }

  return "i can help with open bounty ideas, wallet funding instructions, and autonomous evaluation/finalization flow.";
}

export function buildFarcasterCastDraft(
  post: DecisionPost,
  author?: string
): FarcasterCastDraft {
  return {
    text: buildDecisionMessage(post, author),
    embeds: post.url ? [{ url: post.url }] : [],
    author,
    parentUrl: post.url
  };
}

export function buildDecisionRelayEnvelope(post: DecisionPost): DecisionRelayEnvelope {
  const author = getEnv("SOCIAL_AUTHOR", "");
  const targets = parseSocialTargets();
  const message = buildDecisionMessage(post, author);
  const castDraft = buildFarcasterCastDraft(post, author);
  const followUpAnswers = buildFollowUpAnswers(post.reason);

  return {
    targets,
    message,
    castDraft,
    decision: post,
    followUpAnswers
  };
}

function stringifyWithBigInts(value: unknown): string {
  return JSON.stringify(value, (_, current) =>
    typeof current === "bigint" ? current.toString() : current
  );
}

function formatFetchFailure(target: string, error: unknown): Error {
  if (error instanceof Error) {
    const cause = error.cause as { code?: string; address?: string; port?: number } | undefined;
    if (cause?.code === "ECONNREFUSED") {
      const location = cause.address && cause.port ? `${cause.address}:${cause.port}` : target;
      return new Error(
        `Unable to reach ${location}. Start the relay or social service before running the bot.`
      );
    }

    if (cause?.code === "ENOTFOUND") {
      return new Error(`Unable to resolve ${target}. Check the webhook or API URL.`);
    }

    if (cause?.code === "ETIMEDOUT") {
      return new Error(`Timed out while contacting ${target}. Check network connectivity.`);
    }
  }

  return new Error(`Failed to contact ${target}.`);
}

type NeynarCastResponse = {
  success?: boolean;
  cast?: {
    hash?: string;
  };
};

export async function postCastViaNeynar(
  castDraft: FarcasterCastDraft,
  options?: { parentCastHash?: string }
): Promise<string | undefined> {
  const apiKey = getEnv("NEYNAR_API_KEY", "");
  const signerUuid = getEnv("FARCASTER_SIGNER_UUID", "");
  const channelId = getEnv("FARCASTER_CHANNEL_ID", "");

  if (!apiKey || !signerUuid) {
    return undefined;
  }

  const response = await fetch("https://api.neynar.com/v2/farcaster/cast/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      signer_uuid: signerUuid,
      text: castDraft.text,
      embeds: castDraft.embeds.map((embed) => ({ url: embed.url })),
      channel_id: channelId || undefined,
      parent: options?.parentCastHash || undefined
    })
  }).catch((error: unknown) => {
    throw formatFetchFailure("https://api.neynar.com/v2/farcaster/cast/", error);
  });

  if (!response.ok) {
    throw new Error(`Failed to post Farcaster cast via Neynar: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as NeynarCastResponse;
  if (payload.success === false) {
    throw new Error("Failed to post Farcaster cast via Neynar: success=false");
  }

  return payload.cast?.hash;
}

export async function postDecision(post: DecisionPost): Promise<boolean> {
  const webhookUrl = getEnv("DECISION_WEBHOOK_URL", "");
  const envelope = buildDecisionRelayEnvelope(post);

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stringifyWithBigInts(envelope)
    }).catch((error: unknown) => {
      throw formatFetchFailure(webhookUrl, error);
    });

    if (!response.ok) {
      throw new Error(`Failed to post social update: ${response.status} ${response.statusText}`);
    }

    return true;
  }

  console.log(envelope.message);
  return false;
}
