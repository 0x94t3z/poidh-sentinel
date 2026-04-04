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

export type SocialTarget = "x" | "farcaster";

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

function parseSocialTargets(rawTargets?: string): SocialTarget[] {
  const targets = rawTargets
    ?.split(",")
    .map((target) => target.trim().toLowerCase())
    .filter((target): target is SocialTarget => target === "x" || target === "farcaster");

  if (!targets || targets.length === 0) {
    return ["farcaster"];
  }

  return [...new Set(targets)];
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
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";
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

export function buildFollowUpAnswers(reason: string) {
  return [
    {
      question: "Why did this claim win?",
      answer: reason
    },
    {
      question: "What evidence did the bot check?",
      answer: "It checked the claim tokenURI, claim metadata, resolved content type, and the submission text."
    },
    {
      question: "Was the winner chosen automatically?",
      answer: "Yes. The winner is selected by deterministic scoring logic from all submitted claims."
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
  },
  knownAnswers: Array<{
    question: string;
    answer: string;
  }> = buildFollowUpAnswers(context.reason)
): string {
  const normalizedQuestion = normalizeQuestion(question);

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
    normalizedQuestion.includes("why") ||
    normalizedQuestion.includes("win") ||
    normalizedQuestion.includes("selected")
  ) {
    return context.reason;
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
    return "Yes. The winner is selected by deterministic scoring logic from all submitted claims.";
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

  return `The bot selected the highest-scoring valid claim using deterministic scoring. ${context.reason}`;
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
  const author = process.env.SOCIAL_POST_AUTHOR?.trim();
  const targets = parseSocialTargets(process.env.SOCIAL_POST_TARGETS);
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
  const apiKey = process.env.NEYNAR_API_KEY?.trim();
  const signerUuid = process.env.FARCASTER_SIGNER_UUID?.trim();
  const channelId = process.env.FARCASTER_CHANNEL_ID?.trim();

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
  const webhookUrl = process.env.SOCIAL_POST_WEBHOOK_URL?.trim();
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
