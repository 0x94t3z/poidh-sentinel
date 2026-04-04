import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PoidhBot } from "./bot.js";
import type { DemoClaimConfig } from "./bot.js";
import { resolveFrontendBountyUrl } from "./chains.js";
import { PoidhClient } from "./poidh.js";

function getEnv(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getBool(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function getInt(name: string, fallback: number): number {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

type BountyState = {
  chainName: "arbitrum" | "base" | "degen";
  bountyId: string;
  bountyUrl?: string;
  updatedAt: string;
};

function getBountyStatePath(): string {
  return getEnv("BOUNTY_STATE_FILE", ".poidh-state.json");
}

function getDefaultArtifactDir(command: string): string {
  if (command === "demo-cycle") {
    return "artifacts/demo";
  }
  if (command === "run" || command === "watch-bounty") {
    return "artifacts/production";
  }
  return "artifacts";
}

async function readBountyState(chainName: "arbitrum" | "base" | "degen"): Promise<bigint | undefined> {
  try {
    const raw = await readFile(getBountyStatePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<BountyState>;
    if (parsed.chainName !== chainName || !parsed.bountyId) {
      return undefined;
    }
    return BigInt(parsed.bountyId);
  } catch {
    return undefined;
  }
}

function normalizeFlagName(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function getDemoClaimPrivateKey(): string {
  return getEnv("DEMO_CLAIM_PRIVATE_KEY", getEnv("CLAIM_PRIVATE_KEY"));
}

function parseDemoClaimSlot(index: 1 | 2): DemoClaimConfig | undefined {
  const prefix = `DEMO_CLAIM_${index}_`;
  const privateKey = getEnv(`${prefix}PRIVATE_KEY`);
  const name = getEnv(`${prefix}NAME`);
  const description = getEnv(`${prefix}DESCRIPTION`);
  const proofUri = getEnv(`${prefix}PROOF_URI`);
  const proofFile = getEnv(`${prefix}PROOF_FILE`);
  const expectedClaimantAddress = getAddressEnv(`${prefix}EXPECTED_CLAIMANT_ADDRESS`);

  const hasAnyValue =
    privateKey.length > 0 ||
    name.length > 0 ||
    description.length > 0 ||
    proofUri.length > 0 ||
    proofFile.length > 0 ||
    expectedClaimantAddress !== undefined;

  if (!hasAnyValue) {
    return undefined;
  }

  if (!privateKey) {
    throw new Error(`Missing required environment variable: ${prefix}PRIVATE_KEY`);
  }
  if (!name) {
    throw new Error(`Missing required environment variable: ${prefix}NAME`);
  }
  if (!description) {
    throw new Error(`Missing required environment variable: ${prefix}DESCRIPTION`);
  }

  return {
    privateKey,
    name,
    description,
    proofUri: proofUri || undefined,
    proofFile: proofFile || undefined,
    expectedClaimantAddress
  };
}

function parseLegacyDemoClaim(): DemoClaimConfig | undefined {
  const privateKey = getDemoClaimPrivateKey();
  const name = getEnv("CLAIM_NAME");
  const description = getEnv("CLAIM_DESCRIPTION");
  const proofUri = getEnv("CLAIM_PROOF_URI");
  const proofFile = getEnv("CLAIM_PROOF_FILE");
  const expectedClaimantAddress = getAddressEnv("EXPECTED_CLAIMANT_ADDRESS", getEnv("DEMO_CLAIMANT_ADDRESS"));

  const hasAnyValue =
    privateKey.length > 0 ||
    name.length > 0 ||
    description.length > 0 ||
    proofUri.length > 0 ||
    proofFile.length > 0 ||
    expectedClaimantAddress !== undefined;

  if (!hasAnyValue) {
    return undefined;
  }

  if (!privateKey) {
    throw new Error("Missing required environment variable: DEMO_CLAIM_PRIVATE_KEY");
  }
  if (!name) {
    throw new Error("Missing required environment variable: CLAIM_NAME");
  }
  if (!description) {
    throw new Error("Missing required environment variable: CLAIM_DESCRIPTION");
  }

  return {
    privateKey,
    name,
    description,
    proofUri: proofUri || undefined,
    proofFile: proofFile || undefined,
    expectedClaimantAddress
  };
}

function getAddressEnv(name: string, fallback = ""): `0x${string}` | undefined {
  const value = getEnv(name, fallback);
  if (!value) {
    return undefined;
  }
  if (!value.startsWith("0x")) {
    throw new Error(`Environment variable ${name} must be a 0x-prefixed address.`);
  }
  return value as `0x${string}`;
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

async function run() {
  const [command = "run", ...rest] = process.argv.slice(2);
  const { flags } = parseFlagMap(rest);

  const chainName = getChainName();
  const rpcUrl = requireEnv("RPC_URL");
  const privateKey = requireEnv("PRIVATE_KEY");
  const pollIntervalMs = getInt("POLL_INTERVAL_MS", 60_000);
  const autoAccept = getBool("AUTO_ACCEPT", true);
  const bountyKind = (getEnv("BOUNTY_KIND", "solo") === "open" ? "open" : "solo") as "solo" | "open";
  const bountyName = getEnv("BOUNTY_NAME", "Take a photo of something blue outdoors");
  const bountyDescription = getEnv(
    "BOUNTY_DESCRIPTION",
    "Upload a clear outdoor photo of something blue."
  );
  const bountyAmountEth = getEnv("BOUNTY_AMOUNT_ETH", "0.001");
  const autoSubmitClaim = getBool("AUTO_SUBMIT_CLAIM", false);
  const artifactDir = getEnv("ARTIFACT_DIR", getDefaultArtifactDir(command));
  const pinataJwt = getEnv("PINATA_JWT");
  const pinataGatewayUrl = getEnv("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs");
  const bountyStatePath = getBountyStatePath();
  const demoClaims = [parseDemoClaimSlot(1), parseDemoClaimSlot(2)].filter(
    (claim): claim is DemoClaimConfig => claim !== undefined
  );
  const legacyDemoClaim = parseLegacyDemoClaim();
  const configuredDemoClaims = demoClaims.length > 0 ? demoClaims : legacyDemoClaim ? [legacyDemoClaim] : [];
  const flagBountyId =
    typeof flags.bountyId === "string"
      ? flags.bountyId
      : typeof flags["bounty-id"] === "string"
        ? (flags["bounty-id"] as string)
        : undefined;
  const explicitBountyId = parseBountyId(flagBountyId ?? getEnv("BOUNTY_ID"));
  const shouldReuseState = command !== "create-bounty";
  const stateBountyId = shouldReuseState && !explicitBountyId ? await readBountyState(chainName) : undefined;
  const bountyId = explicitBountyId ?? stateBountyId;

  const bot = new PoidhBot({
    chainName,
    rpcUrl,
    privateKey,
    pollIntervalMs,
    autoAccept,
    bountyKind,
    bountyName,
    bountyDescription,
    bountyAmountEth,
    autoSubmitClaim,
    artifactDir: artifactDir || undefined,
    bountyId,
    bountyStatePath,
    demoClaims: configuredDemoClaims,
    pinataJwt: pinataJwt || undefined,
    pinataGatewayUrl: pinataGatewayUrl || undefined
  });

  if (
    bountyId !== undefined &&
    (command === "run" || command === "watch-bounty" || command === "demo-cycle")
  ) {
    await bot.persistBountyState();
  }

  switch (command) {
    case "create-bounty": {
      const id = await bot.createBountyIfNeeded();
      const issuerClient = bot.issuerClient;
      console.log(`Bounty ID: ${id.toString()}`);
      console.log(`Frontend URL: ${resolveFrontendBountyUrl(chainName, id)}`);
      console.log(`Issuer: ${issuerClient.account.address}`);
      for (const claim of configuredDemoClaims) {
        const claimClient = new PoidhClient(chainName, rpcUrl, claim.privateKey);
        console.log(`Demo claim wallet: ${claimClient.account.address}`);
      }
      break;
    }
    case "submit-claim": {
      if (bountyId === undefined) {
        throw new Error("submit-claim requires --bounty-id or BOUNTY_ID");
      }
      await bot.submitConfiguredClaims(bountyId);
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
    case "run": {
      await bot.runWatcher();
      break;
    }
    case "demo-cycle": {
      await bot.runDemoCycle();
      break;
    }
    default:
      throw new Error(
        `Unknown command "${command}". Use create-bounty, submit-claim, evaluate-bounty, explain-bounty, resolve-vote, watch-bounty, demo-cycle, or run.`
      );
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
