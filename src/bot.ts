import { writeFile } from "node:fs/promises";
import { parseEther } from "viem";
import { evaluateClaims } from "./core/evaluate.js";
import { resolveFrontendBountyUrl } from "./core/chains.js";
import { postDecision } from "./core/social.js";
import { PoidhClient } from "./core/poidh.js";
import type { BountyTuple, ClaimEvaluation } from "./core/types.js";
import { validateRealWorldBounty } from "./runtime/bountyValidation.js";
import { writeDecisionArtifacts } from "./runtime/decisionArtifacts.js";

export type BotConfig = {
  chainName: "arbitrum" | "base" | "degen";
  rpcUrl: string;
  privateKey: string;
  pollIntervalMs: number;
  autoAccept: boolean;
  minClaimsBeforeAccept: number;
  minDecisionAgeSeconds: number;
  bountyKind: "solo" | "open";
  bountyName: string;
  bountyDescription: string;
  bountyAmountEth: string;
  artifactDir?: string;
  bountyId?: bigint;
  bountyStatePath?: string;
  persistedDecisionKey?: string;
  persistedArtifactKey?: string;
};

export class PoidhBot {
  readonly issuerClient: PoidhClient;
  readonly pollIntervalMs: number;
  readonly autoAccept: boolean;
  readonly minClaimsBeforeAccept: number;
  readonly minDecisionAgeSeconds: number;
  readonly bountyKind: "solo" | "open";
  readonly bountyName: string;
  readonly bountyDescription: string;
  readonly bountyAmountEth: string;
  readonly declaredBountyAmountWei: bigint;
  readonly artifactDir?: string;
  readonly bountyStatePath?: string;
  readonly persistedDecisionKey?: string;
  readonly persistedArtifactKey?: string;
  bountyId?: bigint;
  lastDecisionKey?: string;
  lastArtifactKey?: string;
  lastBountyTxHash?: `0x${string}`;
  lastClaimTxHash?: `0x${string}`;
  lastFinalActionTxHash?: `0x${string}`;
  lastClaimId?: bigint;
  submittedClaims: Array<{
    claimId: string;
    claimTxHash: `0x${string}`;
    claimantAddress: `0x${string}`;
    name: string;
    description: string;
  }>;
  bountyUrl?: string;

  constructor(config: BotConfig) {
    this.issuerClient = new PoidhClient(config.chainName, config.rpcUrl, config.privateKey);
    this.pollIntervalMs = config.pollIntervalMs;
    this.autoAccept = config.autoAccept;
    this.minClaimsBeforeAccept = Math.max(1, Math.floor(config.minClaimsBeforeAccept));
    this.minDecisionAgeSeconds = Math.max(0, Math.floor(config.minDecisionAgeSeconds));
    this.bountyKind = config.bountyKind;
    this.bountyName = config.bountyName;
    this.bountyDescription = config.bountyDescription;
    this.bountyAmountEth = config.bountyAmountEth;
    this.declaredBountyAmountWei = parseEther(config.bountyAmountEth);
    this.artifactDir = config.artifactDir;
    this.bountyStatePath = config.bountyStatePath;
    this.persistedDecisionKey = config.persistedDecisionKey;
    this.persistedArtifactKey = config.persistedArtifactKey;
    this.bountyId = config.bountyId;
    this.lastDecisionKey = config.persistedDecisionKey;
    this.lastArtifactKey = config.persistedArtifactKey;
    this.lastBountyTxHash = undefined;
    this.lastClaimTxHash = undefined;
    this.lastFinalActionTxHash = undefined;
    this.lastClaimId = undefined;
    this.submittedClaims = [];
    this.bountyUrl = undefined;
  }

  async persistBountyState(bountyId: bigint = this.bountyId ?? 0n): Promise<void> {
    if (!this.bountyStatePath) {
      return;
    }
    if (bountyId === 0n) {
      throw new Error("Cannot persist bounty state without a bounty ID.");
    }

    const bountyUrl = this.bountyUrl ?? resolveFrontendBountyUrl(this.issuerClient.chainName, bountyId);
    await writeFile(
      this.bountyStatePath,
      `${JSON.stringify(
        {
          chainName: this.issuerClient.chainName,
          bountyId: bountyId.toString(),
          bountyUrl,
          lastDecisionKey: this.lastDecisionKey,
          lastArtifactKey: this.lastArtifactKey,
          updatedAt: new Date().toISOString()
        },
        null,
        2
      )}\n`,
      "utf8"
    );
  }

  async createBountyIfNeeded() {
    if (this.bountyId !== undefined) {
      return this.bountyId;
    }

    const validationErrors = validateRealWorldBounty(this.bountyName, this.bountyDescription);
    if (validationErrors.length > 0) {
      throw new Error(`Real-world bounty validation failed: ${validationErrors.join(" ")}`);
    }

    const result = await this.issuerClient.createBounty(
      this.bountyKind,
      this.bountyName,
      this.bountyDescription,
      parseEther(this.bountyAmountEth)
    );

    this.bountyId = result.bountyId;
    this.lastBountyTxHash = result.hash;
    this.bountyUrl = result.url;
    await this.persistBountyState(result.bountyId);
    console.log(`Created bounty ${result.bountyId.toString()} at ${result.url}`);
    return result.bountyId;
  }

  async waitForBountyCreation(): Promise<bigint> {
    while (true) {
      try {
        return await this.createBountyIfNeeded();
      } catch (error) {
        console.error("Bounty creation failed; waiting for funding or network recovery.");
        console.error(error);
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      }
    }
  }

  async evaluateBounty(bountyId: bigint): Promise<ClaimEvaluation[]> {
    const bounty = await this.issuerClient.getBounty(bountyId);
    const claims = await this.issuerClient.getAllClaims(bountyId);
    const tokenUris = await this.issuerClient.getTokenUris(claims.map((claim) => claim.id));
    return evaluateClaims(bounty.name, bounty.description, claims, tokenUris);
  }

  async actOnBounty(bountyId: bigint): Promise<{ bounty: BountyTuple; evaluations: ClaimEvaluation[] } | undefined> {
    const bounty = await this.issuerClient.getBounty(bountyId);
    const claims = await this.issuerClient.getAllClaims(bountyId);

    if (claims.length === 0) {
      console.log(`Bounty ${bountyId.toString()} has no claims yet.`);
      return undefined;
    }

    const evaluations = await this.evaluateBounty(bountyId);
    const winner = evaluations[0];

    if (!winner) {
      console.log(`No valid claims found for bounty ${bountyId.toString()}.`);
      return undefined;
    }

    const reason = winner.reasons.join(" ");
    const frontendUrl = resolveFrontendBountyUrl(this.issuerClient.chainName, bountyId);
    const decisionKey = `${bountyId.toString()}:${winner.claim.id.toString()}`;

    console.log(`Best claim: ${winner.claim.id.toString()} (${winner.score.toFixed(2)})`);
    console.log(reason);

    const publishDecisionIfNeeded = async () => {
      if (this.lastDecisionKey === decisionKey) {
        return;
      }
      await postDecision({
        bountyId,
        bountyTitle: bounty.name,
        winningClaimId: winner.claim.id,
        reason,
        url: frontendUrl
      });
      this.lastDecisionKey = decisionKey;
      await this.persistBountyState(bountyId);
    };

    if (!this.autoAccept) {
      await publishDecisionIfNeeded();
      return { bounty, evaluations };
    }

    if (claims.length < this.minClaimsBeforeAccept) {
      console.log(
        `Auto-accept is waiting: ${claims.length} claim(s) found, requires at least ${this.minClaimsBeforeAccept}.`
      );
      return { bounty, evaluations };
    }

    if (this.minDecisionAgeSeconds > 0) {
      const earliestClaimCreatedAt = claims.reduce(
        (earliest, claim) => (claim.createdAt < earliest ? claim.createdAt : earliest),
        claims[0]!.createdAt
      );
      const now = BigInt(Math.floor(Date.now() / 1000));
      const minReadyTime = earliestClaimCreatedAt + BigInt(this.minDecisionAgeSeconds);
      if (now < minReadyTime) {
        const waitSeconds = Number(minReadyTime - now);
        console.log(
          `Auto-accept is waiting: decision window is still open for ${waitSeconds} more second(s).`
        );
        return { bounty, evaluations };
      }
    }

    const currentVotingClaim = await this.issuerClient.getCurrentVotingClaim(bountyId);
    const hasExternalContributor = await this.issuerClient.hasExternalContributor(bountyId);
    let canPublishFinalDecision = false;

    if (currentVotingClaim !== 0n) {
      const tracker = await this.issuerClient.getVotingTracker(bountyId);
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now >= tracker.deadline) {
        const resolveHash = await this.issuerClient.resolveVote(bountyId);
        await this.issuerClient.waitForReceipt(resolveHash);
        this.lastFinalActionTxHash = resolveHash;
        console.log(`Resolved vote for bounty ${bountyId.toString()}.`);
        canPublishFinalDecision = true;
      } else {
        console.log(
          `Vote still active for bounty ${bountyId.toString()} and ends at ${tracker.deadline.toString()}.`
        );
      }
    } else if (this.bountyKind === "open" && hasExternalContributor) {
      const voteHash = await this.issuerClient.submitClaimForVote(bountyId, winner.claim.id);
      await this.issuerClient.waitForReceipt(voteHash);
      this.lastFinalActionTxHash = voteHash;
      console.log(`Submitted claim ${winner.claim.id.toString()} for vote.`);
      canPublishFinalDecision = true;
    } else if (!winner.claim.accepted) {
      const acceptHash = await this.issuerClient.acceptClaim(bountyId, winner.claim.id);
      await this.issuerClient.waitForReceipt(acceptHash);
      this.lastFinalActionTxHash = acceptHash;
      console.log(`Accepted claim ${winner.claim.id.toString()}.`);
      canPublishFinalDecision = true;
    } else {
      console.log(`Winner claim ${winner.claim.id.toString()} is already accepted.`);
      canPublishFinalDecision = true;
    }

    if (canPublishFinalDecision) {
      await publishDecisionIfNeeded();
    }

    return { bounty, evaluations };
  }

  async runWatcher() {
    const bountyId = await this.waitForBountyCreation();

    while (true) {
      try {
        const result = await this.actOnBounty(bountyId);
        if (result) {
          await this.persistDecisionArtifacts(bountyId, result.bounty, result.evaluations);
        }
      } catch (error) {
        console.error(error);
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  async persistDecisionArtifacts(
    bountyId: bigint,
    bounty: Awaited<ReturnType<PoidhClient["getBounty"]>>,
    evaluations: ClaimEvaluation[]
  ) {
    const winner = evaluations[0];
    if (!winner) {
      return undefined;
    }

    const decisionKey = `${bountyId.toString()}:${winner.claim.id.toString()}`;
    if (this.lastArtifactKey === decisionKey) {
      return undefined;
    }

    const artifactDir = this.artifactDir ?? "artifacts";
    const bountyUrl = this.bountyUrl ?? resolveFrontendBountyUrl(this.issuerClient.chainName, bountyId);
    const issuerPendingWithdrawals = await this.issuerClient.getPendingWithdrawals(this.issuerClient.account.address);

    const reason = winner.reasons.join(" ");
    const { reportPaths, socialPaths, farcasterPaths } = await writeDecisionArtifacts({
      artifactDir,
      chainName: this.issuerClient.chainName,
      issuerAddress: this.issuerClient.account.address,
      issuerPendingWithdrawalsWei: issuerPendingWithdrawals.toString(),
      bountyId,
      bounty,
      declaredBountyAmountWei: this.declaredBountyAmountWei,
      bountyUrl,
      bountyTxHash: this.lastBountyTxHash,
      claimId: this.lastClaimId?.toString(),
      claimTxHash: this.lastClaimTxHash,
      submittedClaims: this.submittedClaims,
      finalActionTxHash: this.lastFinalActionTxHash,
      winnerClaimId: winner.claim.id,
      evaluations,
      reason,
      author: process.env.SOCIAL_POST_AUTHOR?.trim()
    });

    this.lastArtifactKey = decisionKey;
    await this.persistBountyState(bountyId);
    return {
      reportPaths,
      socialPaths,
      farcasterPaths
    };
  }
}
