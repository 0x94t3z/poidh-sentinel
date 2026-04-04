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

  return {
    targets,
    message,
    castDraft,
    decision: post
  };
}

export async function postDecision(post: DecisionPost): Promise<boolean> {
  const webhookUrl = process.env.SOCIAL_POST_WEBHOOK_URL?.trim();
  const envelope = buildDecisionRelayEnvelope(post);

  if (!webhookUrl) {
    console.log(envelope.message);
    return false;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(envelope)
  });

  if (!response.ok) {
    throw new Error(`Failed to post social update: ${response.status} ${response.statusText}`);
  }

  return true;
}
