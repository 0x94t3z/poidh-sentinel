import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PoidhBot } from "./bot.js";
import { resolveFrontendBountyUrl } from "./core/chains.js";
import { getBoolAny, getEnv, getInt, getIntAny, requireEnv } from "./config.js";

function getChainName(): "arbitrum" | "base" | "degen" {
  const value = getEnv("POIDH_CHAIN", "arbitrum").toLowerCase();
  if (value === "arbitrum" || value === "base" || value === "degen") {
    return value;
  }
  throw new Error(`Unsupported POIDH_CHAIN value: ${value}`);
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
  return getEnv("BOUNTY_STATE_FILE", ".poidh-state.json");
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

function printWatchBountyBanner(minParticipantsBeforeFinalize: number, firstClaimCooldownSeconds: number) {
  console.log("watch-bounty: resume monitoring an existing bounty, evaluate claims, resolve, then post the decision thread.");
  console.log(
    `Auto-finalize wait: requires at least ${minParticipantsBeforeFinalize} claim(s) before final action${firstClaimCooldownSeconds > 0 ? ` and waits ${firstClaimCooldownSeconds} second(s) after the first claim` : ""}.`
  );
  if (minParticipantsBeforeFinalize > 1) {
    console.log("Expected behavior: after the first claim, the bot keeps polling until more submissions arrive.");
  }
}

function printCreateNewBountyBanner() {
  console.log("create-new-bounty: create a fresh bounty and stop after the on-chain creation step.");
}

async function run() {
  const [rawCommand = "requirements-flow", ...rest] = process.argv.slice(2);
  const command = rawCommand;
  const { flags } = parseFlagMap(rest);

  const chainName = getChainName();
  const rpcUrl = requireEnv("RPC_URL");
  const privateKey = requireEnv("PRIVATE_KEY");
  const pollIntervalMs = getInt("POLL_INTERVAL_MS", 60_000);
  const autoFinalizeWinner = getBoolAny(["AUTO_FINALIZE_WINNER", "AUTO_ACCEPT"], true);
  const minParticipantsBeforeFinalize = Math.max(
    1,
    getIntAny(["MIN_PARTICIPANTS_BEFORE_FINALIZE", "MIN_CLAIMS_BEFORE_ACCEPT"], 1)
  );
  const firstClaimCooldownSeconds = Math.max(
    0,
    getIntAny(["FIRST_CLAIM_COOLDOWN_SECONDS", "MIN_DECISION_AGE_SECONDS"], 0)
  );
  const bountyKind = (getEnv("BOUNTY_KIND", "solo") === "open" ? "open" : "solo") as "solo" | "open";
  const bountyName = getEnv("BOUNTY_NAME", "Take a photo of something blue outdoors");
  const bountyDescription = getEnv(
    "BOUNTY_DESCRIPTION",
    "Upload a clear outdoor photo of something blue."
  );
  const bountyAmountEth = getEnv("BOUNTY_AMOUNT_ETH", "0.001");
  const artifactDir = getEnv("ARTIFACT_DIR", getDefaultArtifactDir(command));
  const bountyStatePath = getBountyStatePath();
  if (process.env.AUTO_ACCEPT?.trim() && !process.env.AUTO_FINALIZE_WINNER?.trim()) {
    console.log("Using legacy env AUTO_ACCEPT. Prefer AUTO_FINALIZE_WINNER.");
  }
  if (
    process.env.MIN_CLAIMS_BEFORE_ACCEPT?.trim() &&
    !process.env.MIN_PARTICIPANTS_BEFORE_FINALIZE?.trim()
  ) {
    console.log(
      "Using legacy env MIN_CLAIMS_BEFORE_ACCEPT. Prefer MIN_PARTICIPANTS_BEFORE_FINALIZE."
    );
  }
  if (
    process.env.MIN_DECISION_AGE_SECONDS?.trim() &&
    !process.env.FIRST_CLAIM_COOLDOWN_SECONDS?.trim()
  ) {
    console.log(
      "Using legacy env MIN_DECISION_AGE_SECONDS. Prefer FIRST_CLAIM_COOLDOWN_SECONDS."
    );
  }
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
    artifactDir: artifactDir || undefined,
    bountyId,
    bountyStatePath,
    persistedDecisionKey: state?.lastDecisionKey,
    persistedArtifactKey: state?.lastArtifactKey
  });

  if (bountyId !== undefined && (command === "requirements-flow" || command === "watch-bounty")) {
    await bot.persistBountyState();
  }

  switch (command) {
    case "create-new-bounty": {
      printCreateNewBountyBanner();
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
      const winner = evaluations[0];
      if (!winner) {
        console.log(`No claims found for bounty ${bountyId.toString()}.`);
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
