import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { postCastViaNeynar, type DecisionRelayEnvelope } from "./social.js";

type RelayState = {
  generatedAt: string;
  sourceIp?: string;
  envelope: DecisionRelayEnvelope;
  publishedToFarcaster: boolean;
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
    `- Published to Farcaster: ${state.publishedToFarcaster}`,
    `- Targets: ${state.envelope.targets.join(", ")}`,
    `- Message:`,
    `  ${state.envelope.message}`
  ];

  if (state.sourceIp) {
    lines.push(`- Source IP: ${state.sourceIp}`);
  }

  lines.push(``, `## Cast`, ``, `- Text:`, `  ${state.envelope.castDraft.text}`);

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

    const publishedToFarcaster = await postCastViaNeynar(body.castDraft);
    const state: RelayState = {
      generatedAt: new Date().toISOString(),
      sourceIp: request.socket.remoteAddress ?? undefined,
      envelope: body,
      publishedToFarcaster
    };

    await writeRelayArtifacts(state);
    jsonResponse(response, 200, {
      ok: true,
      publishedToFarcaster,
      targetCount: body.targets.length
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
    note: "The latest decision payload is written by the relay after each post."
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
