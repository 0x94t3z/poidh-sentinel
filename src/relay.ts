import "dotenv/config";
import { createHmac, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { type DecisionRelayEnvelope } from "./social.js";

type RelayState = {
  generatedAt: string;
  sourceIp?: string;
  envelope: DecisionRelayEnvelope;
  publishedToX: boolean;
  xPostIds: string[];
  xError?: string;
};

function getEnv(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function getInt(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function relayOutputDir(): string {
  return getEnv("RELAY_OUTPUT_DIR", "artifacts/relay");
}

function relayPort(): number {
  return getInt("RELAY_PORT", 8787);
}

function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function buildOAuth1Header(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  accessToken: string,
  accessTokenSecret: string
): string {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: "1.0"
  };

  const sortedParams = Object.entries(oauthParams).sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    `${percentEncode(leftKey)}=${percentEncode(leftValue)}`.localeCompare(
      `${percentEncode(rightKey)}=${percentEncode(rightValue)}`
    )
  );

  const parameterString = sortedParams
    .map(([key, value]) => `${percentEncode(key)}=${percentEncode(value)}`)
    .join("&");

  const baseString = [
    method.toUpperCase(),
    percentEncode(normalizeUrl(url)),
    percentEncode(parameterString)
  ].join("&");

  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(accessTokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  return `OAuth ${Object.entries({
    ...oauthParams,
    oauth_signature: signature
  })
    .map(([key, value]) => `${percentEncode(key)}="${percentEncode(value)}"`)
    .join(", ")}`;
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildXPostTexts(envelope: DecisionRelayEnvelope): { main: string; reply: string } {
  const { bountyId, bountyTitle, winningClaimId, reason, url } = envelope.decision;

  const main = truncateText(
    [
      `poidh decision: ${bountyTitle}`,
      `winner claim: ${winningClaimId.toString()}`,
      url ? url : undefined
    ]
      .filter(Boolean)
      .join("\n"),
    280
  );

  const reply = truncateText(
    [
      `Why it won for bounty ${bountyId.toString()}:`,
      `- ${truncateText(reason, 180)}`,
      `- ${truncateText(envelope.followUpAnswers[1]?.answer ?? "The bot checked the claim metadata and proof content.", 180)}`
    ].join("\n"),
    280
  );

  return { main, reply };
}

type XPostResponse = {
  data?: {
    id?: string;
  };
};

async function postTweet(text: string, replyToTweetId?: string): Promise<string | undefined> {
  const consumerKey = process.env.X_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.X_CONSUMER_SECRET?.trim();
  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET?.trim();

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    return undefined;
  }

  const url = "https://api.x.com/2/tweets";
  const authorization = buildOAuth1Header(
    "POST",
    url,
    consumerKey,
    consumerSecret,
    accessToken,
    accessTokenSecret
  );

  const body = replyToTweetId
    ? {
        text,
        reply: {
          in_reply_to_tweet_id: replyToTweetId
        }
      }
    : { text };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post X status: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const payload = (await response.json()) as XPostResponse;
  return payload.data?.id;
}

function jsonResponse(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as unknown;
}

function isRelayEnvelope(value: unknown): value is DecisionRelayEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DecisionRelayEnvelope>;
  return (
    Array.isArray(candidate.targets) &&
    typeof candidate.message === "string" &&
    typeof candidate.castDraft?.text === "string" &&
    Array.isArray(candidate.castDraft?.embeds) &&
    Array.isArray(candidate.followUpAnswers)
  );
}

function renderRelayMarkdown(state: RelayState): string {
  const lines = [
    `# poidh relay payload`,
    ``,
    `- Generated at: ${state.generatedAt}`,
    `- Published to X: ${state.publishedToX}`,
    `- X post IDs: ${state.xPostIds.join(", ") || "none"}`,
    state.xError ? `- X error: ${state.xError}` : undefined,
    `- Targets: ${state.envelope.targets.join(", ")}`,
    `- Message:`,
    `  ${state.envelope.message}`
  ].filter(Boolean) as string[];

  if (state.sourceIp) {
    lines.push(`- Source IP: ${state.sourceIp}`);
  }

  lines.push(``, `## Post Draft`, ``, `- Text:`, `  ${state.envelope.castDraft.text}`);

  if (state.envelope.castDraft.author) {
    lines.push(`- Author: ${state.envelope.castDraft.author}`);
  }
  if (state.envelope.castDraft.parentUrl) {
    lines.push(`- Parent URL: ${state.envelope.castDraft.parentUrl}`);
  }
  if (state.envelope.castDraft.embeds.length > 0) {
    lines.push(``, `## Embeds`, ``);
    for (const embed of state.envelope.castDraft.embeds) {
      lines.push(`- ${embed.url}`);
    }
  }

  lines.push(``, `## Follow-up Answers`, ``);
  for (const item of state.envelope.followUpAnswers) {
    lines.push(`- ${item.question}`);
    lines.push(`  - ${item.answer}`);
  }

  return lines.join("\n");
}

async function writeRelayArtifacts(state: RelayState) {
  const outputDir = relayOutputDir();
  await mkdir(outputDir, { recursive: true });
  const baseName = `poidh-relay-${state.envelope.decision.bountyId}`;
  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${renderRelayMarkdown(state)}\n`, "utf8");
}

async function handleDecision(request: IncomingMessage, response: ServerResponse) {
  try {
    const body = await readJsonBody(request);
    if (!isRelayEnvelope(body)) {
      jsonResponse(response, 400, { ok: false, error: "Invalid decision payload." });
      return;
    }

    const { main, reply } = buildXPostTexts(body);
    let mainTweetId: string | undefined;
    let replyTweetId: string | undefined;
    let xError: string | undefined;

    try {
      mainTweetId = await postTweet(main);
      replyTweetId = mainTweetId ? await postTweet(reply, mainTweetId) : undefined;
    } catch (error) {
      xError = error instanceof Error ? error.message : "Unknown X posting error";
      console.error(xError);
    }

    const state: RelayState = {
      generatedAt: new Date().toISOString(),
      sourceIp: request.socket.remoteAddress ?? undefined,
      envelope: body,
      publishedToX: Boolean(mainTweetId),
      xPostIds: [mainTweetId, replyTweetId].filter(Boolean) as string[],
      xError
    };

    await writeRelayArtifacts(state);
    jsonResponse(response, 200, {
      ok: true,
      publishedToX: Boolean(mainTweetId),
      xPostIds: state.xPostIds,
      targetCount: body.targets.length,
      xError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown relay error";
    jsonResponse(response, 500, { ok: false, error: message });
  }
}

async function handleExplain(response: ServerResponse) {
  const outputDir = relayOutputDir();
  jsonResponse(response, 200, {
    ok: true,
    outputDir,
    note: "The latest decision payload is written by the relay after each X post."
  });
}

function startRelay() {
  const port = relayPort();
  const server = createServer((request, response) => {
    if (!request.url) {
      jsonResponse(response, 404, { ok: false, error: "Missing URL." });
      return;
    }

    if (request.method === "POST" && request.url === "/decision") {
      void handleDecision(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/explain") {
      void handleExplain(response);
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      jsonResponse(response, 200, { ok: true });
      return;
    }

    jsonResponse(response, 404, { ok: false, error: "Not found." });
  });

  server.listen(port, () => {
    console.log(`poidh relay listening on http://127.0.0.1:${port}`);
    console.log(`POST decisions to http://127.0.0.1:${port}/decision`);
  });
}

startRelay();
