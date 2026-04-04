import { parseEther } from "viem";
import { evaluateClaims } from "./evaluate.js";
import { resolveFrontendBountyUrl } from "./chains.js";
import { summarizeEvaluations, writeDemoArtifact } from "./artifacts.js";
import { postDecision } from "./social.js";
import { PoidhClient } from "./poidh.js";
import { buildClaimTokenUri, isJsonMetadataTokenUri } from "./uri.js";
import type { ClaimEvaluation } from "./types.js";

export type BotConfig = {
  chainName: "arbitrum" | "base" | "degen";
  rpcUrl: string;
  privateKey: string;
  claimPrivateKey?: string;
  pollIntervalMs: number;
  autoAccept: boolean;
  bountyKind: "solo" | "open";
  bountyName: string;
  bountyDescription: string;
  bountyAmountEth: string;
  artifactDir?: string;
  bountyId?: bigint;
  claimName?: string;
  claimDescription?: string;
  claimProofUri?: string;
};

export class PoidhBot {
  readonly client: PoidhClient;
  readonly pollIntervalMs: number;
  readonly autoAccept: boolean;
  readonly bountyKind: "solo" | "open";
  readonly bountyName: string;
  readonly bountyDescription: string;
  readonly bountyAmountEth: string;
  readonly artifactDir?: string;
  bountyId?: bigint;
  lastDecisionKey?: string;
  lastBountyTxHash?: `0x${string}`;
  lastClaimTxHash?: `0x${string}`;
  lastFinalActionTxHash?: `0x${string}`;
  lastClaimId?: bigint;
  bountyUrl?: string;
  readonly claimClient?: PoidhClient;
  readonly claimName?: string;
  readonly claimDescription?: string;
  readonly claimProofUri?: string;

  constructor(config: BotConfig) {
    this.client = new PoidhClient(config.chainName, config.rpcUrl, config.privateKey);
    this.claimClient = config.claimPrivateKey
      ? new PoidhClient(config.chainName, config.rpcUrl, config.claimPrivateKey)
      : undefined;
    this.pollIntervalMs = config.pollIntervalMs;
    this.autoAccept = config.autoAccept;
    this.bountyKind = config.bountyKind;
    this.bountyName = config.bountyName;
    this.bountyDescription = config.bountyDescription;
    this.bountyAmountEth = config.bountyAmountEth;
    this.artifactDir = config.artifactDir;
    this.bountyId = config.bountyId;
    this.lastDecisionKey = undefined;
    this.lastBountyTxHash = undefined;
    this.lastClaimTxHash = undefined;
    this.lastFinalActionTxHash = undefined;
    this.lastClaimId = undefined;
    this.bountyUrl = undefined;
    this.claimName = config.claimName;
    this.claimDescription = config.claimDescription;
    this.claimProofUri = config.claimProofUri;
  }

  async createBountyIfNeeded() {
    if (this.bountyId !== undefined) {
      return this.bountyId;
    }

    const result = await this.client.createBounty(
      this.bountyKind,
      this.bountyName,
      this.bountyDescription,
      parseEther(this.bountyAmountEth)
    );

    this.bountyId = result.bountyId;
    this.lastBountyTxHash = result.hash;
    this.bountyUrl = result.url;
    console.log(`Created bounty ${result.bountyId.toString()} at ${result.url}`);
    return result.bountyId;
  }

  async submitClaimIfConfigured(bountyId: bigint) {
    if (!this.claimName || !this.claimDescription || !this.claimProofUri) {
      return undefined;
    }

    const submitter = this.claimClient ?? this.client;
    if (submitter.account.address.toLowerCase() === this.client.account.address.toLowerCase()) {
      console.log("Claim wallet matches issuer wallet, skipping claim submission.");
      return undefined;
    }

    const tokenUri = isJsonMetadataTokenUri(this.claimProofUri)
      ? this.claimProofUri
      : buildClaimTokenUri({
          name: this.claimName,
          description: this.claimDescription,
          imageUrl: this.claimProofUri
        });

    const hash = await submitter.createClaim(
      bountyId,
      this.claimName,
      this.claimDescription,
      tokenUri
    );
    const receipt = await submitter.waitForReceipt(hash);
    const claimId = await submitter.extractClaimIdFromReceipt(hash);
    this.lastClaimTxHash = hash;
    this.lastClaimId = claimId;
    console.log(`Submitted claim ${claimId.toString()} in tx ${receipt.transactionHash}`);
    return claimId;
  }

  async evaluateBounty(bountyId: bigint): Promise<ClaimEvaluation[]> {
    const bounty = await this.client.getBounty(bountyId);
    const claims = await this.client.getAllClaims(bountyId);
    const tokenUris = await this.client.getTokenUris(claims.map((claim) => claim.id));
    return evaluateClaims(bounty.name, bounty.description, claims, tokenUris);
  }

  async actOnBounty(bountyId: bigint) {
    const bounty = await this.client.getBounty(bountyId);
    const claims = await this.client.getAllClaims(bountyId);

    if (claims.length === 0) {
      console.log(`Bounty ${bountyId.toString()} has no claims yet.`);
      return;
    }

    const evaluations = await this.evaluateBounty(bountyId);
    const winner = evaluations[0];

    if (!winner) {
      console.log(`No valid claims found for bounty ${bountyId.toString()}.`);
      return;
    }

    const reason = winner.reasons.join(" ");
    const frontendUrl = resolveFrontendBountyUrl(this.client.chainName, bountyId);
    const decisionKey = `${bountyId.toString()}:${winner.claim.id.toString()}`;

    console.log(`Best claim: ${winner.claim.id.toString()} (${winner.score.toFixed(2)})`);
    console.log(reason);

    if (this.lastDecisionKey !== decisionKey) {
      await postDecision({
        bountyId,
        bountyTitle: bounty.name,
        winningClaimId: winner.claim.id,
        reason,
        url: frontendUrl
      });
      this.lastDecisionKey = decisionKey;
    }

    if (!this.autoAccept) {
      return;
    }

    const currentVotingClaim = await this.client.getCurrentVotingClaim(bountyId);
    const hasExternalContributor = await this.client.hasExternalContributor(bountyId);

    if (currentVotingClaim !== 0n) {
      const tracker = await this.client.getVotingTracker(bountyId);
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now >= tracker.deadline) {
        const resolveHash = await this.client.resolveVote(bountyId);
        await this.client.waitForReceipt(resolveHash);
        this.lastFinalActionTxHash = resolveHash;
        console.log(`Resolved vote for bounty ${bountyId.toString()}.`);
      } else {
        console.log(
          `Vote still active for bounty ${bountyId.toString()} and ends at ${tracker.deadline.toString()}.`
        );
      }
      return;
    }

    if (this.bountyKind === "open" && hasExternalContributor) {
      const voteHash = await this.client.submitClaimForVote(bountyId, winner.claim.id);
      await this.client.waitForReceipt(voteHash);
      this.lastFinalActionTxHash = voteHash;
      console.log(`Submitted claim ${winner.claim.id.toString()} for vote.`);
      return;
    }

    if (!winner.claim.accepted) {
      const acceptHash = await this.client.acceptClaim(bountyId, winner.claim.id);
      await this.client.waitForReceipt(acceptHash);
      this.lastFinalActionTxHash = acceptHash;
      console.log(`Accepted claim ${winner.claim.id.toString()}.`);
      return;
    }

    console.log(`Winner claim ${winner.claim.id.toString()} is already accepted.`);
  }

  async runWatcher() {
    const bountyId = await this.createBountyIfNeeded();

    if (this.claimName && this.claimDescription && this.claimProofUri) {
      await this.submitClaimIfConfigured(bountyId);
    }

    while (true) {
      try {
        await this.actOnBounty(bountyId);
      } catch (error) {
        console.error(error);
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  async runDemoCycle() {
    if (!this.claimClient) {
      throw new Error("demo-cycle requires DEMO_CLAIM_PRIVATE_KEY for a separate claimant wallet.");
    }
    if (!this.claimName || !this.claimDescription || !this.claimProofUri) {
      throw new Error("demo-cycle requires CLAIM_NAME, CLAIM_DESCRIPTION, and CLAIM_PROOF_URI.");
    }

    const bountyId = await this.createBountyIfNeeded();
    await this.submitClaimIfConfigured(bountyId);
    const evaluations = await this.evaluateBounty(bountyId);
    await this.actOnBounty(bountyId);
    const bounty = await this.client.getBounty(bountyId);
    const artifactDir = this.artifactDir ?? "artifacts";
    const artifact = {
      generatedAt: new Date().toISOString(),
      chainName: this.client.chainName,
      issuerAddress: this.client.account.address,
      claimantAddress: this.claimClient?.account.address,
      bountyId: bountyId.toString(),
      bountyUrl: this.bountyUrl ?? resolveFrontendBountyUrl(this.client.chainName, bountyId),
      bountyName: bounty.name,
      bountyDescription: bounty.description,
      bountyAmountWei: bounty.amount.toString(),
      bountyTxHash: this.lastBountyTxHash,
      claimId: this.lastClaimId?.toString(),
      claimTxHash: this.lastClaimTxHash,
      finalActionTxHash: this.lastFinalActionTxHash,
      winnerClaimId: evaluations[0]?.claim.id.toString(),
      evaluations: summarizeEvaluations(evaluations)
    };

    const paths = await writeDemoArtifact(artifactDir, artifact);
    console.log(`Demo artifact written to ${paths.jsonPath} and ${paths.markdownPath}`);
    return artifact;
  }
}
