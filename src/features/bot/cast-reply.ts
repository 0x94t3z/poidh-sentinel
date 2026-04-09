import "server-only";

interface PublishReplyParams {
  text: string;
  parentHash: string;
  signerUuid: string;
  embedUrl?: string;
}

interface PublishCastParams {
  text: string;
  signerUuid: string;
  channelId?: string; // e.g. "poidh"
  embedUrl?: string;  // URL to embed as a link preview
}

interface NeynarPublishResponse {
  cast: {
    hash: string;
    text: string;
    author: { fid: number; username: string };
    timestamp: string;
  };
}

async function postToNeynar(
  signerUuid: string,
  text: string,
  options: { parent?: string; channelId?: string; embedUrl?: string } = {},
): Promise<string> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error("NEYNAR_API_KEY is not configured");
  if (!signerUuid) throw new Error("BOT_SIGNER_UUID is not configured — bot cannot post casts");

  const body: Record<string, unknown> = { signer_uuid: signerUuid, text };
  if (options.parent) body.parent = options.parent;
  if (options.channelId) body.channel_id = options.channelId;
  if (options.embedUrl) body.embeds = [{ url: options.embedUrl }];

  const response = await fetch("https://api.neynar.com/v2/farcaster/cast", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Neynar cast publish failed ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as NeynarPublishResponse;
  return data.cast.hash;
}

// Reply in-thread (always has a parent)
export async function publishReply(params: PublishReplyParams): Promise<string> {
  return postToNeynar(params.signerUuid, params.text, { parent: params.parentHash, embedUrl: params.embedUrl });
}

// Top-level cast on the bot's profile, optionally in a channel
export async function publishCast(params: PublishCastParams): Promise<string> {
  return postToNeynar(params.signerUuid, params.text, {
    channelId: params.channelId,
    embedUrl: params.embedUrl,
  });
}

interface CastNode {
  hash: string;
  text: string;
  author: { username: string; fid: number };
  direct_replies?: CastNode[];
}

// Fetch the full thread conversation as a flat list of messages in order.
// Uses the thread_hash (root) to get the whole chain, then flattens it.
export async function fetchCastThread(threadHashOrCastHash: string): Promise<Array<{ username: string; text: string }>> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${threadHashOrCastHash}&type=hash&reply_depth=5&include_chronological_parent_casts=true&limit=20`,
      { headers: { "x-api-key": apiKey } },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      conversation?: { cast?: CastNode };
    };
    const root = data.conversation?.cast;
    if (!root) return [];

    // Flatten the tree into a chronological list
    const messages: Array<{ username: string; text: string }> = [];

    function walk(node: CastNode) {
      messages.push({ username: node.author.username, text: node.text });
      for (const reply of node.direct_replies ?? []) {
        walk(reply);
      }
    }
    walk(root);

    // Return up to last 10 messages (keep context window small)
    return messages.slice(-10);
  } catch {
    return [];
  }
}
