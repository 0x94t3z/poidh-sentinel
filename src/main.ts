import "dotenv/config";
import { PoidhBot } from "./bot.js";
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

function getDemoClaimPrivateKey(): string {
  return getEnv("DEMO_CLAIM_PRIVATE_KEY", getEnv("CLAIM_PRIVATE_KEY"));
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
      flags[key] = raw ?? "";
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[cleaned] = true;
      continue;
    }

    flags[cleaned] = next;
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
  const bountyName = getEnv("BOUNTY_NAME", "Autonomous poidh demo");
  const bountyDescription = getEnv("BOUNTY_DESCRIPTION", "Real-world action bounty for a demo run.");
  const bountyAmountEth = getEnv("BOUNTY_AMOUNT_ETH", "0.001");
  const claimPrivateKey = getDemoClaimPrivateKey();
  const artifactDir = getEnv("ARTIFACT_DIR");
  const claimProofFile = getEnv("CLAIM_PROOF_FILE");
  const pinataJwt = getEnv("PINATA_JWT");
  const pinataGatewayUrl = getEnv("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs");
  const flagBountyId = typeof flags.bountyId === "string" ? flags.bountyId : undefined;
  const bountyId = parseBountyId(flagBountyId ?? getEnv("BOUNTY_ID"));

  const bot = new PoidhBot({
    chainName,
    rpcUrl,
    privateKey,
    claimPrivateKey: claimPrivateKey || undefined,
    pollIntervalMs,
    autoAccept,
    bountyKind,
    bountyName,
    bountyDescription,
    bountyAmountEth,
    artifactDir: artifactDir || undefined,
    bountyId,
    claimName: getEnv("CLAIM_NAME"),
    claimDescription: getEnv("CLAIM_DESCRIPTION"),
    claimProofUri: getEnv("CLAIM_PROOF_URI"),
    claimProofFile: claimProofFile || undefined,
    pinataJwt: pinataJwt || undefined,
    pinataGatewayUrl: pinataGatewayUrl || undefined
  });

  switch (command) {
    case "create-bounty": {
      const id = await bot.createBountyIfNeeded();
      const client = bot.client;
      console.log(`Bounty ID: ${id.toString()}`);
      console.log(`Frontend URL: ${resolveFrontendBountyUrl(chainName, id)}`);
      console.log(`Issuer: ${client.account.address}`);
      if (claimPrivateKey) {
        const claimClient = new PoidhClient(chainName, rpcUrl, claimPrivateKey);
        console.log(`Claim wallet: ${claimClient.account.address}`);
      }
      break;
    }
    case "submit-claim": {
      if (bountyId === undefined) {
        throw new Error("submit-claim requires --bounty-id or BOUNTY_ID");
      }
      await bot.submitClaimIfConfigured(bountyId);
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
    case "resolve-vote": {
      if (bountyId === undefined) {
        throw new Error("resolve-vote requires --bounty-id or BOUNTY_ID");
      }
      const hash = await bot.client.resolveVote(bountyId);
      const receipt = await bot.client.waitForReceipt(hash);
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
        `Unknown command "${command}". Use create-bounty, submit-claim, evaluate-bounty, resolve-vote, watch-bounty, demo-cycle, or run.`
      );
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
