import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PoidhBot } from "./bot.js";
import { resolveFrontendBountyUrl } from "./core/chains.js";
import type { EvaluationMode } from "./core/evaluate.js";
import { getBool, getEnv, getInt, requireEnv } from "./config.js";

function getChainName(): "arbitrum" | "base" | "degen" {
  const value = getEnv("TARGET_CHAIN", "arbitrum").toLowerCase();
  if (value === "arbitrum" || value === "base" || value === "degen") {
    return value;
  }
  throw new Error(`Unsupported TARGET_CHAIN value: ${value}`);
}

function getEvaluationMode(): EvaluationMode {
  const value = getEnv("WINNER_EVALUATION_MODE", "ai_hybrid").toLowerCase();
  if (value === "deterministic" || value === "ai_hybrid" || value === "ai_required") {
    return value;
  }
  throw new Error(
    `Unsupported WINNER_EVALUATION_MODE value: ${value}. Use deterministic, ai_hybrid, or ai_required.`
  );
}

function parseBountyId(flagValue?: string): bigint | undefined {
  if (!flagValue) {
    return undefined;
  }
  return BigInt(flagValue);
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    const shortMessage = (error as Error & { shortMessage?: string }).shortMessage;
    return shortMessage || error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}

function formatCliError(error: unknown): string[] {
  const text = getErrorText(error);
  const lowerText = text.toLowerCase();

  if (lowerText.includes("insufficient funds") || lowerText.includes("exceeds the balance of the account")) {
    return [
      "Insufficient funds for the bounty transaction.",
      "Top up the issuer wallet on Arbitrum, then rerun the command.",
      "For a 0.001 ETH bounty, keep a little extra for gas."
    ];
  }

  return [text];
}

type BountyState = {
  chainName: "arbitrum" | "base" | "degen";
  bountyId: string;
  bountyUrl?: string;
  lastDecisionKey?: string;
  lastArtifactKey?: string;
  updatedAt: string;
};

function getBountyStatePath(): string {
  return getEnv("BOT_STATE_FILE", ".poidh-state.json");
}

function getDefaultArtifactDir(command: string): string {
  if (command === "requirements-flow" || command === "watch-bounty") {
    return "artifacts/production";
  }
  return "artifacts";
}

async function readBountyState(chainName: "arbitrum" | "base" | "degen"): Promise<BountyState | undefined> {
  try {
    const raw = await readFile(getBountyStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<BountyState>;
    if (parsed.chainName !== chainName || !parsed.bountyId) {
      return undefined;
    }
    return {
      chainName: parsed.chainName,
      bountyId: parsed.bountyId,
      bountyUrl: parsed.bountyUrl,
      lastDecisionKey: parsed.lastDecisionKey,
      lastArtifactKey: parsed.lastArtifactKey,
      updatedAt: parsed.updatedAt ?? new Date().toISOString()
    };
  } catch {
    return undefined;
  }
}

function normalizeFlagName(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function parseFlagMap(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }

    const cleaned = value.slice(2);
    if (cleaned.includes("=")) {
      const [key, raw] = cleaned.split("=", 2);
      flags[normalizeFlagName(key)] = raw ?? "";
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[normalizeFlagName(cleaned)] = true;
      continue;
    }

    flags[normalizeFlagName(cleaned)] = next;
    index += 1;
  }

  return { flags, positionals };
}

function printRequirementsFlowBanner(minParticipantsBeforeFinalize: number, firstClaimCooldownSeconds: number) {
  console.log("requirements-flow: create bounty, wait for submissions, evaluate, resolve, then post the decision thread.");
  console.log(
    `Auto-finalize wait: requires at least ${minParticipantsBeforeFinalize} claim(s) before final action${firstClaimCooldownSeconds > 0 ? ` and waits ${firstClaimCooldownSeconds} second(s) after the first claim` : ""}.`
  );
  if (minParticipantsBeforeFinalize > 1) {
    console.log("Expected behavior: after the first claim, the bot keeps polling until more submissions arrive.");
  }
}

function printWatchBountyBanner(
  minParticipantsBeforeFinalize: number,
  firstClaimCooldownSeconds: number
) {
  console.log("watch-bounty: resume monitoring an existing bounty, evaluate claims, resolve, then post the decision thread.");
  console.log(
    `Auto-finalize wait: requires at least ${minParticipantsBeforeFinalize} claim(s) before final action${firstClaimCooldownSeconds > 0 ? ` and waits ${firstClaimCooldownSeconds} second(s) after the first claim` : ""}.`
  );
  if (minParticipantsBeforeFinalize > 1) {
    console.log("Expected behavior: after the first claim, the bot keeps polling until more submissions arrive.");
  }
}

function printCreateNewBountyBanner(config: {
  bountyKind: "solo" | "open";
  bountyAmountEth: string;
  bountyName: string;
  bountyDescription: string;
}) {
  console.log("create-new-bounty: create a fresh bounty and stop after the on-chain creation step.");
  console.log(`Mode: ${config.bountyKind}`);
  console.log(`Reward: ${config.bountyAmountEth} ETH`);
  console.log(`Title: ${config.bountyName}`);
  console.log(`Prompt: ${config.bountyDescription}`);
}

async function run() {
  const [rawCommand = "requirements-flow", ...rest] = process.argv.slice(2);
  const command = rawCommand;
  const { flags } = parseFlagMap(rest);

  const chainName = getChainName();
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  const privateKey = requireEnv("BOT_PRIVATE_KEY");
  const pollIntervalMs = Math.max(1, getInt("WATCH_POLL_INTERVAL_MS", 60_000));
  const autoFinalizeWinner = getBool("AUTO_FINALIZE_WINNER", false);
  const minParticipantsBeforeFinalize = Math.max(
    1,
    getInt("MIN_PARTICIPANTS_BEFORE_FINALIZE", 1)
  );
  const firstClaimCooldownSeconds = Math.max(
    0,
    getInt("FIRST_CLAIM_COOLDOWN_SECONDS", 0)
  );
  const bountyKind = (getEnv("BOUNTY_MODE", "solo") === "open" ? "open" : "solo") as "solo" | "open";
  const bountyName = getEnv(
    "BOUNTY_TITLE",
    "Photo of a handwritten note with today’s date"
  );
  const bountyDescription = getEnv(
    "BOUNTY_PROMPT",
    "Upload a clear outdoor photo of a handwritten note that says today’s full date, your username, and the word poidh."
  );
  const bountyAmountEth = getEnv("BOUNTY_REWARD_ETH", "0.001");
  const evaluationMode = getEvaluationMode();
  const aiApiKey = getEnv("OPENROUTER_API_KEY", "");
  const aiModel = getEnv("OPENROUTER_MODEL", "nvidia/nemotron-nano-12b-v2-vl:free");
  const aiMinConfidence = Math.max(0, Math.min(1, Number(getEnv("AI_EVALUATION_MIN_CONFIDENCE", "0.55")) || 0.55));
  const aiEnableVision = getBool("AI_EVALUATION_ENABLE_VISION", true);
  const aiInspectLinkedUrls = getBool("AI_EVALUATION_INSPECT_LINKS", true);
  const aiMaxLinkedUrls = Math.max(0, getInt("AI_EVALUATION_MAX_LINKS", 2));
  const artifactDir = getEnv("PRODUCTION_ARTIFACT_DIR", getDefaultArtifactDir(command));
  const bountyStatePath = getBountyStatePath();
  const flagBountyId =
    typeof flags.bountyId === "string"
      ? flags.bountyId
      : typeof flags["bounty-id"] === "string"
        ? (flags["bounty-id"] as string)
        : undefined;
  const explicitBountyId = parseBountyId(flagBountyId ?? getEnv("BOUNTY_ID"));
  const shouldReuseState = command !== "create-new-bounty";
  const state = shouldReuseState && !explicitBountyId ? await readBountyState(chainName) : undefined;
  const bountyId = explicitBountyId ?? (state ? BigInt(state.bountyId) : undefined);

  const bot = new PoidhBot({
    chainName,
    rpcUrl,
    privateKey,
    pollIntervalMs,
    autoFinalizeWinner,
    minParticipantsBeforeFinalize,
    firstClaimCooldownSeconds,
    bountyKind,
    bountyName,
    bountyDescription,
    bountyAmountEth,
    evaluationMode,
    aiApiKey,
    aiModel,
    aiMinConfidence,
    aiEnableVision,
    aiInspectLinkedUrls,
    aiMaxLinkedUrls,
    artifactDir: artifactDir || undefined,
    bountyId,
    bountyStatePath,
    persistedDecisionKey: state?.lastDecisionKey,
    persistedArtifactKey: state?.lastArtifactKey
  });

  if (command === "requirements-flow" || command === "watch-bounty" || command === "evaluate-bounty" || command === "explain-bounty") {
    console.log(`Winner evaluation mode: ${evaluationMode}`);
    if (evaluationMode !== "deterministic" && !aiApiKey) {
      console.log("AI evaluator key is missing, so winner selection falls back to deterministic-only behavior.");
    } else if (evaluationMode !== "deterministic") {
      console.log(
        `AI evidence checks: vision=${aiEnableVision ? "on" : "off"}, link-inspection=${aiInspectLinkedUrls ? "on" : "off"} (max ${aiMaxLinkedUrls} links).`
      );
    }
  }

  if (bountyId !== undefined && (command === "requirements-flow" || command === "watch-bounty")) {
    await bot.persistBountyState();
  }

  switch (command) {
    case "create-new-bounty": {
      printCreateNewBountyBanner({
        bountyKind,
        bountyAmountEth,
        bountyName,
        bountyDescription
      });
      const id = await bot.createBountyIfNeeded();
      const issuerClient = bot.issuerClient;
      console.log(`Bounty ID: ${id.toString()}`);
      console.log(`Frontend URL: ${resolveFrontendBountyUrl(chainName, id)}`);
      console.log(`Issuer: ${issuerClient.account.address}`);
      break;
    }
    case "evaluate-bounty": {
      if (bountyId === undefined) {
        throw new Error("evaluate-bounty requires --bounty-id or BOUNTY_ID");
      }
      const evaluations = await bot.evaluateBounty(bountyId);
      for (const evaluation of evaluations) {
        console.log(
          JSON.stringify(
            {
              claimId: evaluation.claim.id.toString(),
              score: evaluation.score,
              accepted: evaluation.claim.accepted,
              reasons: evaluation.reasons,
              proof: evaluation.evidence.contentUri
            },
            null,
            2
          )
        );
      }
      break;
    }
    case "explain-bounty": {
      if (bountyId === undefined) {
        throw new Error("explain-bounty requires --bounty-id or BOUNTY_ID");
      }
      const evaluations = await bot.evaluateBounty(bountyId);
      const winner = evaluations.find((evaluation) => evaluation.score >= 0);
      if (!winner) {
        console.log(`No valid claim found for bounty ${bountyId.toString()}.`);
        break;
      }

      console.log(
        JSON.stringify(
          {
            bountyId: bountyId.toString(),
            winnerClaimId: winner.claim.id.toString(),
            score: winner.score,
            reasons: winner.reasons,
            evidence: {
              tokenUri: winner.evidence.tokenUri,
              contentUri: winner.evidence.contentUri,
              contentType: winner.evidence.contentType,
              title: winner.evidence.title,
              imageUrl: winner.evidence.imageUrl,
              animationUrl: winner.evidence.animationUrl
            },
            evaluations: evaluations.map((evaluation) => ({
              claimId: evaluation.claim.id.toString(),
              score: evaluation.score,
              accepted: evaluation.claim.accepted,
              reasons: evaluation.reasons
            }))
          },
          null,
          2
        )
      );
      break;
    }
    case "resolve-vote": {
      if (bountyId === undefined) {
        throw new Error("resolve-vote requires --bounty-id or BOUNTY_ID");
      }
      const hash = await bot.issuerClient.resolveVote(bountyId);
      const receipt = await bot.issuerClient.waitForReceipt(hash);
      console.log(`Resolved vote in tx ${receipt.transactionHash}`);
      break;
    }
    case "watch-bounty":
    case "requirements-flow": {
      if (command === "requirements-flow") {
        printRequirementsFlowBanner(minParticipantsBeforeFinalize, firstClaimCooldownSeconds);
      } else {
        printWatchBountyBanner(minParticipantsBeforeFinalize, firstClaimCooldownSeconds);
      }
      await bot.runWatcher();
      break;
    }
    default:
      throw new Error(
        `Unknown command "${rawCommand}". Use requirements-flow, create-new-bounty, watch-bounty, evaluate-bounty, explain-bounty, or resolve-vote.`
      );
  }
}

run().catch((error) => {
  for (const line of formatCliError(error)) {
    console.error(line);
  }
  process.exitCode = 1;
});
