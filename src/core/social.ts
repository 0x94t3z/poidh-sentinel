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

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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
  const apiKey = getEnv("OPENROUTER_API_KEY", "");
  const model = getEnv("OPENROUTER_MODEL", "openrouter/free");
  if (!apiKey) {
    return undefined;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 180,
      messages: [
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
  }
): Promise<string | undefined> {
  const apiKey = getEnv("OPENROUTER_API_KEY", "");
  const model = getEnv("OPENROUTER_MODEL", "openrouter/free");
  if (!apiKey) {
    return undefined;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You are a concise, friendly Farcaster bot. Answer the user's question directly in lowercase, without mentioning policy or being verbose. If they ask about open bounty ideas, suggest one real-world bounty. If they ask how to chat, mention the thread reply or mention flow. If they ask about funding, give the bot wallet address if available. Return plain text only."
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
              question
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
  return rawText.length > 0 ? rawText : undefined;
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

function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  } = {}
): string {
  const normalizedQuestion = normalizeQuestion(question);
  const minBountyEth = context.minBountyEth ?? "0.001";

  if (
    normalizedQuestion.includes("idea") ||
    normalizedQuestion.includes("open bounty") ||
    normalizedQuestion.includes("crowdfund")
  ) {
    return "good open bounty idea: upload a clear outdoor photo of a handwritten note with today’s full date, your username, and `poidh`, then keep it open for at least 2 participants before finalizing.";
  }

  if (
    normalizedQuestion.includes("chat") ||
    normalizedQuestion.includes("talk") ||
    normalizedQuestion.includes("best way")
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
    normalizedQuestion.includes("wallet") ||
    normalizedQuestion.includes("fund") ||
    normalizedQuestion.includes("address")
  ) {
    if (context.botWalletAddress) {
      return `funding wallet: ${context.botWalletAddress}. send at least ${minBountyEth} ETH plus gas buffer, then i can create an open bounty from that wallet.`;
    }
    return "funding wallet is not configured yet. once BOT_PRIVATE_KEY is set, i can share the exact funding address.";
  }

  if (
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
