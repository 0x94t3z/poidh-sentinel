import "dotenv/config";
import { createHmac } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import {
  answerFollowUpQuestion,
  buildDecisionMessage,
  buildDecisionReply,
  postCastViaNeynar,
  polishDecisionCopy,
  type DecisionRelayEnvelope
} from "./social.js";

type RelayState = {
  generatedAt: string;
  sourceIp?: string;
  envelope: DecisionRelayEnvelope;
  publishedToFarcaster: boolean;
  farcasterCastIds: string[];
  farcasterError?: string;
  followUpReplies: Array<{
    generatedAt: string;
    question: string;
    answer: string;
    postedToFarcaster: boolean;
    farcasterCastHash?: string;
    parentCastHash?: string;
    source?: string;
  }>;
};

type FollowUpRequest = {
  bountyId?: string | number;
  question?: string;
  text?: string;
  message?: string;
  replyToCastHash?: string;
  parentCastHash?: string;
  source?: string;
};

type NeynarWebhookEvent = {
  type?: string;
  data?: {
    hash?: string;
    parent_hash?: string | null;
    thread_hash?: string | null;
    text?: string;
    author?: {
      fid?: number;
    };
  };
};

function normalizeRelayState(state: RelayState): RelayState {
  return {
    ...state,
    followUpReplies: state.followUpReplies ?? []
  };
}

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

function productionArtifactDir(): string {
  return getEnv("ARTIFACT_DIR", "artifacts/production");
}

function relayPort(): number {
  return getInt("RELAY_PORT", 8787);
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

async function buildCastTexts(envelope: DecisionRelayEnvelope): Promise<{ main: string; reply: string }> {
  const deterministic = {
    main: truncateText(buildDecisionMessage(envelope.decision, envelope.castDraft.author), 280),
    reply: truncateText(
      buildDecisionReply(
        envelope.decision,
        envelope.decision.reason,
        envelope.castDraft.author,
        envelope.followUpAnswers
      ),
      280
    )
  };

  const polished = await polishDecisionCopy(
    envelope.decision,
    envelope.followUpAnswers,
    envelope.castDraft.author
  );

  if (!polished) {
    return deterministic;
  }

  return {
    main: truncateText(polished.main, 280),
    reply: truncateText(polished.reply, 280)
  };
}

function relayArtifactBaseName(bountyId: string): string {
  return `poidh-relay-${bountyId}`;
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function verifyNeynarWebhookSignature(rawBody: string, signature?: string | null): boolean {
  const secret = process.env.NEYNAR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return true;
  }
  if (!signature) {
    return false;
  }

  const hmac = createHmac("sha512", secret);
  hmac.update(rawBody);
  return hmac.digest("hex") === signature;
}

async function readRequestBody(request: IncomingMessage): Promise<{ raw: string; json?: unknown }> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return { raw };
  }
  return { raw, json: JSON.parse(raw) as unknown };
}

async function loadRelayState(bountyId: string): Promise<RelayState | undefined> {
  const state = await readJsonFile<RelayState>(join(relayOutputDir(), `${relayArtifactBaseName(bountyId)}.json`));
  return state ? normalizeRelayState(state) : undefined;
}

async function findRelayStateByCastHash(castHash: string): Promise<RelayState | undefined> {
  const outputDir = relayOutputDir();
  const entries = await readdir(outputDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json") || !entry.name.startsWith("poidh-relay-")) {
      continue;
    }

    const state = await readJsonFile<RelayState>(join(outputDir, entry.name));
    if (!state) {
      continue;
    }

    const normalized = normalizeRelayState(state);
    if (normalized.farcasterCastIds.includes(castHash)) {
      return normalized;
    }
  }

  return undefined;
}

async function loadProductionArtifact(
  bountyId: string
): Promise<{ finalActionTxHash?: string } | undefined> {
  return readJsonFile<{ finalActionTxHash?: string }>(
    join(productionArtifactDir(), `poidh-production-${bountyId}.json`)
  );
}

function jsonResponse(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
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
    `- Published to Farcaster: ${state.publishedToFarcaster}`,
    `- Farcaster cast hashes: ${state.farcasterCastIds.join(", ") || "none"}`,
    state.farcasterError ? `- Farcaster error: ${state.farcasterError}` : undefined,
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

  if (state.followUpReplies.length > 0) {
    lines.push(``, `## Follow-up Replies`, ``);
    for (const item of state.followUpReplies) {
      lines.push(`- ${item.generatedAt}: ${item.question}`);
      lines.push(`  - ${item.answer}`);
      lines.push(`  - Posted to Farcaster: ${item.postedToFarcaster}`);
      if (item.farcasterCastHash) {
        lines.push(`  - Cast hash: ${item.farcasterCastHash}`);
      }
      if (item.parentCastHash) {
        lines.push(`  - Parent cast hash: ${item.parentCastHash}`);
      }
      if (item.source) {
        lines.push(`  - Source: ${item.source}`);
      }
    }
  }

  return lines.join("\n");
}

async function writeRelayArtifacts(state: RelayState) {
  const outputDir = relayOutputDir();
  await mkdir(outputDir, { recursive: true });
  const baseName = relayArtifactBaseName(state.envelope.decision.bountyId.toString());
  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${renderRelayMarkdown(state)}\n`, "utf8");
}

async function recordRelayStateUpdate(
  bountyId: string,
  update: (state: RelayState) => RelayState
): Promise<RelayState> {
  const existing = await loadRelayState(bountyId);
  if (!existing) {
    throw new Error(`No relay state found for bounty ${bountyId}. Publish a decision first.`);
  }

  const nextState = update(existing);
  await writeRelayArtifacts(nextState);
  return nextState;
}

async function handleDecision(request: IncomingMessage, response: ServerResponse) {
  try {
    const { json } = await readRequestBody(request);
    if (!isRelayEnvelope(json)) {
      jsonResponse(response, 400, { ok: false, error: "Invalid decision payload." });
      return;
    }

    const body = json;
    const { reply } = await buildCastTexts(body);
    let mainCastHash: string | undefined;
    let replyCastHash: string | undefined;
    let farcasterError: string | undefined;

    try {
      mainCastHash = await postCastViaNeynar(body.castDraft);
      replyCastHash = mainCastHash
        ? await postCastViaNeynar(
            {
              text: reply,
              embeds: []
            },
            { parentCastHash: mainCastHash }
          )
        : undefined;
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster posting error";
      console.error(farcasterError);
    }

    const state: RelayState = {
      generatedAt: new Date().toISOString(),
      sourceIp: request.socket.remoteAddress ?? undefined,
      envelope: body,
      publishedToFarcaster: Boolean(mainCastHash),
      farcasterCastIds: [mainCastHash, replyCastHash].filter(Boolean) as string[],
      farcasterError,
      followUpReplies: []
    };

    await writeRelayArtifacts(state);
    jsonResponse(response, 200, {
      ok: true,
      publishedToFarcaster: Boolean(mainCastHash),
      farcasterCastIds: state.farcasterCastIds,
      targetCount: body.targets.length,
      farcasterError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown relay error";
    jsonResponse(response, 500, { ok: false, error: message });
  }
}

async function handleFollowUp(request: IncomingMessage, response: ServerResponse) {
  try {
    const { json } = await readRequestBody(request);
    if (!json || typeof json !== "object") {
      jsonResponse(response, 400, { ok: false, error: "Invalid follow-up payload." });
      return;
    }

    const body = json as FollowUpRequest;
    const bountyId = body.bountyId?.toString().trim();
    const question = body.question?.trim() || body.text?.trim() || body.message?.trim();

    if (!bountyId || !question) {
      jsonResponse(response, 400, {
        ok: false,
        error: "follow-up payload requires bountyId and question."
      });
      return;
    }

    const state = await loadRelayState(bountyId);
    if (!state) {
      jsonResponse(response, 404, {
        ok: false,
        error: `No decision thread stored for bounty ${bountyId}.`
      });
      return;
    }

    const productionArtifact = await loadProductionArtifact(bountyId);
    const answer = answerFollowUpQuestion(question, {
      reason: state.envelope.decision.reason,
      finalActionTxHash: productionArtifact?.finalActionTxHash
    });
    const parentCastHash = body.replyToCastHash?.trim() || body.parentCastHash?.trim() || state.farcasterCastIds[0];

    let farcasterCastHash: string | undefined;
    let farcasterError: string | undefined;

    try {
      farcasterCastHash = await postCastViaNeynar(
        {
          text: answer,
          embeds: [],
          author: state.envelope.castDraft.author,
          parentUrl: state.envelope.castDraft.parentUrl
        },
        { parentCastHash }
      );
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster reply error";
      console.error(farcasterError);
    }

    const generatedAt = new Date().toISOString();
    const nextState = await recordRelayStateUpdate(bountyId, (current) => ({
      ...current,
      farcasterError: farcasterError ?? current.farcasterError,
      followUpReplies: [
        ...current.followUpReplies,
        {
          generatedAt,
          question,
          answer,
          postedToFarcaster: Boolean(farcasterCastHash),
          farcasterCastHash,
          parentCastHash,
          source: body.source?.trim()
        }
      ]
    }));

    jsonResponse(response, 200, {
      ok: true,
      bountyId,
      question,
      answer,
      postedToFarcaster: Boolean(farcasterCastHash),
      farcasterCastHash,
      farcasterError,
      followUpReplies: nextState.followUpReplies.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown follow-up error";
    jsonResponse(response, 500, { ok: false, error: message });
  }
}

async function handleNeynarWebhook(request: IncomingMessage, response: ServerResponse) {
  try {
    const signature = request.headers["x-neynar-signature"];
    const { raw, json } = await readRequestBody(request);

    if (!verifyNeynarWebhookSignature(raw, Array.isArray(signature) ? signature[0] : signature)) {
      jsonResponse(response, 401, { ok: false, error: "Invalid Neynar webhook signature." });
      return;
    }

    if (!json || typeof json !== "object") {
      jsonResponse(response, 400, { ok: false, error: "Invalid Neynar webhook payload." });
      return;
    }

    const event = json as NeynarWebhookEvent;
    if (event.type !== "cast.created" || !event.data?.text) {
      jsonResponse(response, 200, { ok: true, ignored: true });
      return;
    }

    const parentCastHash = event.data.parent_hash ?? event.data.thread_hash ?? undefined;
    if (!parentCastHash) {
      jsonResponse(response, 200, { ok: true, ignored: true });
      return;
    }

    const relayState = await findRelayStateByCastHash(parentCastHash);
    if (!relayState) {
      jsonResponse(response, 200, { ok: true, ignored: true, reason: "No matching bounty thread." });
      return;
    }

    const productionArtifact = await loadProductionArtifact(relayState.envelope.decision.bountyId.toString());
    const answer = answerFollowUpQuestion(event.data.text, {
      reason: relayState.envelope.decision.reason,
      finalActionTxHash: productionArtifact?.finalActionTxHash
    });

    let farcasterCastHash: string | undefined;
    let farcasterError: string | undefined;

    try {
      farcasterCastHash = await postCastViaNeynar(
        {
          text: answer,
          embeds: [],
          author: relayState.envelope.castDraft.author,
          parentUrl: relayState.envelope.castDraft.parentUrl
        },
        { parentCastHash }
      );
    } catch (error) {
      farcasterError = error instanceof Error ? error.message : "Unknown Farcaster reply error";
      console.error(farcasterError);
    }

    const bountyId = relayState.envelope.decision.bountyId.toString();
    const generatedAt = new Date().toISOString();
    const nextState = await recordRelayStateUpdate(bountyId, (current) => ({
      ...current,
      farcasterError: farcasterError ?? current.farcasterError,
      followUpReplies: [
        ...current.followUpReplies,
        {
          generatedAt,
          question: event.data?.text ?? "",
          answer,
          postedToFarcaster: Boolean(farcasterCastHash),
          farcasterCastHash,
          parentCastHash,
          source: `neynar-webhook:${event.data?.author?.fid ?? "unknown"}`
        }
      ]
    }));

    jsonResponse(response, 200, {
      ok: true,
      bountyId,
      question: event.data.text,
      answer,
      postedToFarcaster: Boolean(farcasterCastHash),
      farcasterCastHash,
      farcasterError,
      followUpReplies: nextState.followUpReplies.length
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Neynar webhook error";
    jsonResponse(response, 500, { ok: false, error: message });
  }
}

async function handleExplain(response: ServerResponse) {
  const outputDir = relayOutputDir();
  jsonResponse(response, 200, {
    ok: true,
    outputDir,
    note: "The latest decision payload is written by the relay after each Farcaster post attempt. Follow-up replies can be posted through /follow-up."
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

    if (request.method === "POST" && request.url === "/follow-up") {
      void handleFollowUp(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/webhooks/neynar") {
      void handleNeynarWebhook(request, response);
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
