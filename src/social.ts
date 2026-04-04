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

export async function postDecision(post: DecisionPost): Promise<boolean> {
  const webhookUrl = process.env.SOCIAL_POST_WEBHOOK_URL?.trim();
  const author = process.env.SOCIAL_POST_AUTHOR?.trim();
  const message = buildDecisionMessage(post, author);
  const castDraft = buildFarcasterCastDraft(post, author);

  if (!webhookUrl) {
    console.log(message);
    return false;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      castDraft,
      ...post
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to post social update: ${response.status} ${response.statusText}`);
  }

  return true;
}
