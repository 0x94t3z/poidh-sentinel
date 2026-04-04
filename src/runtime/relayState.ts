import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DecisionRelayEnvelope } from "../core/social.js";
import { getEnv, getInt } from "../config.js";

export type RelayState = {
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

export type FollowUpRequest = {
  bountyId?: string | number;
  question?: string;
  text?: string;
  message?: string;
  replyToCastHash?: string;
  parentCastHash?: string;
  source?: string;
};

export type NeynarWebhookEvent = {
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

export function normalizeRelayState(state: RelayState): RelayState {
  return {
    ...state,
    followUpReplies: state.followUpReplies ?? []
  };
}

export function relayOutputDir(): string {
  return getEnv("RELAY_OUTPUT_DIR", "artifacts/relay");
}

export function productionArtifactDir(): string {
  return getEnv("ARTIFACT_DIR", "artifacts/production");
}

export function relayPort(): number {
  return getInt("RELAY_PORT", 8787);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export async function loadRelayState(bountyId: string): Promise<RelayState | undefined> {
  const state = await readJsonFile<RelayState>(join(relayOutputDir(), `${relayArtifactBaseName(bountyId)}.json`));
  return state ? normalizeRelayState(state) : undefined;
}

export async function findRelayStateByCastHash(castHash: string): Promise<RelayState | undefined> {
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

export async function loadProductionArtifact(
  bountyId: string
): Promise<{ finalActionTxHash?: string } | undefined> {
  return readJsonFile<{ finalActionTxHash?: string }>(
    join(productionArtifactDir(), `poidh-production-${bountyId}.json`)
  );
}

export async function writeRelayArtifacts(state: RelayState) {
  const outputDir = relayOutputDir();
  await mkdir(outputDir, { recursive: true });
  const baseName = relayArtifactBaseName(state.envelope.decision.bountyId.toString());
  const jsonPath = join(outputDir, `${baseName}.json`);
  const markdownPath = join(outputDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, `${renderRelayMarkdown(state)}\n`, "utf8");
}

export async function recordRelayStateUpdate(
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

function relayArtifactBaseName(bountyId: string): string {
  return `poidh-relay-${bountyId}`;
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
