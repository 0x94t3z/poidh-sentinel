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
    return ["x", "farcaster"];
  }

  return [...new Set(targets)];
}

export function buildDecisionMessage(post: DecisionPost, author?: string): string {
  return [
    author ? `by ${author}` : undefined,
    `poidh decision for bounty ${post.bountyId.toString()}: ${post.bountyTitle}`,
    `winner claim: ${post.winningClaimId.toString()}`,
    `reason: ${post.reason}`,
    post.url ? `url: ${post.url}` : undefined
  ]
    .filter(Boolean)
    .join("\n");
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

type NeynarCastResponse = {
  success?: boolean;
};

export async function postCastViaNeynar(castDraft: FarcasterCastDraft): Promise<boolean> {
  const apiKey = process.env.NEYNAR_API_KEY?.trim();
  const signerUuid = process.env.FARCASTER_SIGNER_UUID?.trim();
  const channelId = process.env.FARCASTER_CHANNEL_ID?.trim();

  if (!apiKey || !signerUuid) {
    return false;
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
      parent: castDraft.parentUrl || undefined
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to post Farcaster cast via Neynar: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as NeynarCastResponse;
  return payload.success !== false;
}

export async function postDecision(post: DecisionPost): Promise<boolean> {
  const webhookUrl = process.env.SOCIAL_POST_WEBHOOK_URL?.trim();
  const envelope = buildDecisionRelayEnvelope(post);

  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stringifyWithBigInts(envelope)
    });

    if (!response.ok) {
      throw new Error(`Failed to post social update: ${response.status} ${response.statusText}`);
    }

    return true;
  }

  const postedViaNeynar = await postCastViaNeynar(envelope.castDraft);
  if (postedViaNeynar) {
    return true;
  }

  console.log(envelope.message);
  return false;
}
