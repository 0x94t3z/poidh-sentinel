export type DecisionPost = {
  bountyId: bigint;
  bountyTitle: string;
  winningClaimId: bigint;
  reason: string;
  url?: string;
};

export async function postDecision(post: DecisionPost): Promise<boolean> {
  const webhookUrl = process.env.SOCIAL_POST_WEBHOOK_URL?.trim();
  const message = [
    `poidh decision for bounty ${post.bountyId.toString()}: ${post.bountyTitle}`,
    `winner claim: ${post.winningClaimId.toString()}`,
    `reason: ${post.reason}`,
    post.url ? `url: ${post.url}` : undefined
  ]
    .filter(Boolean)
    .join("\n");

  if (!webhookUrl) {
    console.log(message);
    return false;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message,
      ...post
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to post social update: ${response.status} ${response.statusText}`);
  }

  return true;
}
