import { writeFile } from "node:fs/promises";
import { parseEther } from "viem";
import { evaluateClaims } from "./evaluate.js";
import { resolveFrontendBountyUrl } from "./chains.js";
import {
  summarizeEvaluations,
  writeDemoArtifact,
  writeFarcasterProofArtifact,
  writeSocialProofArtifact
} from "./artifacts.js";
import { buildFarcasterCastDraft, postDecision } from "./social.js";
import { PoidhClient } from "./poidh.js";
import { uploadClaimMetadataToPinata, uploadProofFileToPinata } from "./upload.js";
import { buildClaimTokenUri, isJsonMetadataTokenUri } from "./uri.js";
import type { BountyTuple, ClaimEvaluation } from "./types.js";

export type BotConfig = {
  chainName: "arbitrum" | "base" | "degen";
  rpcUrl: string;
  privateKey: string;
  pollIntervalMs: number;
  autoAccept: boolean;
  autoSubmitClaim: boolean;
  bountyKind: "solo" | "open";
  bountyName: string;
  bountyDescription: string;
  bountyAmountEth: string;
  artifactDir?: string;
  artifactPrefix: "demo" | "production";
  bountyId?: bigint;
  bountyStatePath?: string;
  demoClaims?: DemoClaimConfig[];
  pinataJwt?: string;
  pinataGatewayUrl?: string;
};

export type DemoClaimConfig = {
  privateKey: string;
  name: string;
  description: string;
  proofUri?: string;
  proofFile?: string;
  expectedClaimantAddress?: `0x${string}`;
};

type RuntimeDemoClaim = {
  client: PoidhClient;
  config: DemoClaimConfig;
};

export class PoidhBot {
  readonly issuerClient: PoidhClient;
  readonly rpcUrl: string;
  readonly pollIntervalMs: number;
  readonly autoAccept: boolean;
  readonly autoSubmitClaim: boolean;
  readonly bountyKind: "solo" | "open";
  readonly bountyName: string;
  readonly bountyDescription: string;
  readonly bountyAmountEth: string;
  readonly artifactDir?: string;
  readonly artifactPrefix: "demo" | "production";
  readonly bountyStatePath?: string;
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
  readonly demoClaims: RuntimeDemoClaim[];
  readonly pinataJwt?: string;
  readonly pinataGatewayUrl?: string;

  constructor(config: BotConfig) {
    this.issuerClient = new PoidhClient(config.chainName, config.rpcUrl, config.privateKey);
    this.rpcUrl = config.rpcUrl;
    this.demoClaims = (config.demoClaims ?? []).map((claim) => ({
      client: new PoidhClient(config.chainName, config.rpcUrl, claim.privateKey),
      config: claim
    }));
    this.pollIntervalMs = config.pollIntervalMs;
    this.autoAccept = config.autoAccept;
    this.autoSubmitClaim = config.autoSubmitClaim;
    this.bountyKind = config.bountyKind;
    this.bountyName = config.bountyName;
    this.bountyDescription = config.bountyDescription;
    this.bountyAmountEth = config.bountyAmountEth;
    this.artifactDir = config.artifactDir;
    this.artifactPrefix = config.artifactPrefix;
    this.bountyStatePath = config.bountyStatePath;
    this.bountyId = config.bountyId;
    this.lastDecisionKey = undefined;
    this.lastArtifactKey = undefined;
    this.lastBountyTxHash = undefined;
    this.lastClaimTxHash = undefined;
    this.lastFinalActionTxHash = undefined;
    this.lastClaimId = undefined;
    this.submittedClaims = [];
    this.bountyUrl = undefined;
    this.pinataJwt = config.pinataJwt;
    this.pinataGatewayUrl = config.pinataGatewayUrl;
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

  async waitForClaims(bountyId: bigint, timeoutMs = 30 * 60 * 1000): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const claims = await this.issuerClient.getAllClaims(bountyId);
      if (claims.length > 0) {
        return;
      }

      console.log(`Waiting for public claims on bounty ${bountyId.toString()}...`);
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new Error(`Timed out waiting for claims on bounty ${bountyId.toString()}.`);
  }

  async resolveClaimProofUri(claim: DemoClaimConfig): Promise<string | undefined> {
    if (!claim.name || !claim.description) {
      throw new Error("Claim name and description are required before resolving claim proof.");
    }

    if (claim.proofFile) {
      if (!this.pinataJwt) {
        throw new Error("CLAIM_PROOF_FILE requires PINATA_JWT so the bot can upload the image.");
      }

      const proofUpload = await uploadProofFileToPinata(
        claim.proofFile,
        this.pinataJwt,
        this.pinataGatewayUrl
      );

      const metadataUpload = await uploadClaimMetadataToPinata(
        {
          name: claim.name,
          description: claim.description,
          image: proofUpload.gatewayUrl
        },
        this.pinataJwt,
        this.pinataGatewayUrl
      );

      console.log(`Uploaded claim proof file ${claim.proofFile} to ${proofUpload.gatewayUrl}`);
      console.log(`Uploaded claim metadata to ${metadataUpload.gatewayUrl}`);
      return metadataUpload.gatewayUrl;
    }

    if (claim.proofUri) {
      if (isJsonMetadataTokenUri(claim.proofUri)) {
        return claim.proofUri;
      }

      if (this.pinataJwt) {
        const metadataUpload = await uploadClaimMetadataToPinata(
          {
            name: claim.name,
            description: claim.description,
            image: claim.proofUri
          },
          this.pinataJwt,
          this.pinataGatewayUrl
        );
        console.log(`Uploaded claim metadata to ${metadataUpload.gatewayUrl}`);
        return metadataUpload.gatewayUrl;
      }

      const tokenUri = buildClaimTokenUri({
        name: claim.name,
        description: claim.description,
        imageUrl: claim.proofUri
      });
      return tokenUri;
    }

    return undefined;
  }

  async submitClaimForConfig(bountyId: bigint, claim: DemoClaimConfig) {
    const submitter = new PoidhClient(this.issuerClient.chainName, this.rpcUrl, claim.privateKey);
    if (submitter.account.address.toLowerCase() === this.issuerClient.account.address.toLowerCase()) {
      throw new Error("Claim wallet matches issuer wallet, skipping claim submission.");
    }
    if (claim.expectedClaimantAddress && submitter.account.address.toLowerCase() !== claim.expectedClaimantAddress.toLowerCase()) {
      throw new Error(
        `Claim wallet ${submitter.account.address} does not match expected claimant address ${claim.expectedClaimantAddress}.`
      );
    }

    const claimProofUri = await this.resolveClaimProofUri(claim);
    if (!claimProofUri) {
      return undefined;
    }

    const tokenUri = isJsonMetadataTokenUri(claimProofUri)
      ? claimProofUri
      : buildClaimTokenUri({
          name: claim.name,
          description: claim.description,
          imageUrl: claimProofUri
        });

    const hash = await submitter.createClaim(
      bountyId,
      claim.name,
      claim.description,
      tokenUri
    );
    const receipt = await submitter.waitForReceipt(hash);
    const claimId = await submitter.extractClaimIdFromReceipt(hash);
    this.lastClaimTxHash = hash;
    this.lastClaimId = claimId;
    this.submittedClaims.push({
      claimId: claimId.toString(),
      claimTxHash: hash,
      claimantAddress: submitter.account.address,
      name: claim.name,
      description: claim.description
    });
    console.log(`Submitted claim ${claimId.toString()} in tx ${receipt.transactionHash}`);
    return claimId;
  }

  async submitConfiguredClaims(bountyId: bigint) {
    if (this.demoClaims.length === 0) {
      throw new Error("No demo claims were configured.");
    }

    for (const claim of this.demoClaims) {
      await this.submitClaimForConfig(bountyId, claim.config);
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
      return { bounty, evaluations };
    }
    const currentVotingClaim = await this.issuerClient.getCurrentVotingClaim(bountyId);
    const hasExternalContributor = await this.issuerClient.hasExternalContributor(bountyId);

    if (currentVotingClaim !== 0n) {
      const tracker = await this.issuerClient.getVotingTracker(bountyId);
      const now = BigInt(Math.floor(Date.now() / 1000));
      if (now >= tracker.deadline) {
        const resolveHash = await this.issuerClient.resolveVote(bountyId);
        await this.issuerClient.waitForReceipt(resolveHash);
        this.lastFinalActionTxHash = resolveHash;
        console.log(`Resolved vote for bounty ${bountyId.toString()}.`);
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
    } else if (!winner.claim.accepted) {
      const acceptHash = await this.issuerClient.acceptClaim(bountyId, winner.claim.id);
      await this.issuerClient.waitForReceipt(acceptHash);
      this.lastFinalActionTxHash = acceptHash;
      console.log(`Accepted claim ${winner.claim.id.toString()}.`);
    } else {
      console.log(`Winner claim ${winner.claim.id.toString()} is already accepted.`);
    }

    return { bounty, evaluations };
  }

  async runWatcher() {
    const bountyId = await this.waitForBountyCreation();

    if (this.autoSubmitClaim) {
      await this.submitConfiguredClaims(bountyId);
    }

    while (true) {
      try {
        const result = await this.actOnBounty(bountyId);
        if (result) {
          await this.writeDecisionArtifacts(bountyId, result.bounty, result.evaluations);
        }
      } catch (error) {
        console.error(error);
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  async runDemoCycle() {
    const bountyId = await this.waitForBountyCreation();
    if (this.autoSubmitClaim) {
      if (this.demoClaims.length < 2) {
        throw new Error("demo-cycle requires at least two demo claims when AUTO_SUBMIT_CLAIM is enabled.");
      }
      await this.submitConfiguredClaims(bountyId);
    } else {
      await this.waitForClaims(bountyId);
    }

    const evaluations = await this.evaluateBounty(bountyId);
    const result = await this.actOnBounty(bountyId);
    const artifactBundle = await this.writeDecisionArtifacts(
      bountyId,
      result?.bounty ?? await this.issuerClient.getBounty(bountyId),
      result?.evaluations ?? evaluations
    );
    if (!artifactBundle) {
      throw new Error("Failed to write demo artifacts.");
    }
    const { artifact, demoPaths, socialPaths, farcasterPaths } = artifactBundle;
    const paths = demoPaths;
    console.log(`Demo artifact written to ${paths.jsonPath} and ${paths.markdownPath}`);
    console.log(`Social proof artifact written to ${socialPaths.jsonPath} and ${socialPaths.markdownPath}`);
    console.log(`X/Farcaster proof artifact written to ${farcasterPaths.jsonPath} and ${farcasterPaths.markdownPath}`);
    return artifact;
  }

  async writeDecisionArtifacts(
    bountyId: bigint,
    bounty: Awaited<ReturnType<PoidhClient["getBounty"]>>,
    evaluations: ClaimEvaluation[]
  ):
    | Promise<
        | {
            artifact: {
              generatedAt: string;
              chainName: string;
              issuerAddress: string;
              issuerPendingWithdrawalsWei?: string;
              bountyId: string;
              bountyUrl: string;
              bountyName: string;
              bountyDescription: string;
              bountyAmountWei: string;
              bountyTxHash?: `0x${string}`;
              claimId?: string;
              claimTxHash?: `0x${string}`;
              submittedClaims?: Array<{
                claimId: string;
                claimTxHash: `0x${string}`;
                claimantAddress: string;
                name: string;
                description: string;
              }>;
              finalActionTxHash?: `0x${string}`;
              winnerClaimId?: string;
              evaluations: Array<{
                claimId: string;
                score: number;
                accepted: boolean;
                proof: string;
                reasons: string[];
              }>;
            };
            demoPaths: { jsonPath: string; markdownPath: string };
            socialPaths: { jsonPath: string; markdownPath: string };
            farcasterPaths: { jsonPath: string; markdownPath: string };
          }
        | undefined
      >
  {
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
    const artifact = {
      generatedAt: new Date().toISOString(),
      chainName: this.issuerClient.chainName,
      issuerAddress: this.issuerClient.account.address,
      issuerPendingWithdrawalsWei: issuerPendingWithdrawals.toString(),
      bountyId: bountyId.toString(),
      bountyUrl,
      bountyName: bounty.name,
      bountyDescription: bounty.description,
      bountyAmountWei: bounty.amount.toString(),
      bountyTxHash: this.lastBountyTxHash,
      claimId: this.lastClaimId?.toString(),
      claimTxHash: this.lastClaimTxHash,
      submittedClaims: this.submittedClaims,
      finalActionTxHash: this.lastFinalActionTxHash,
      winnerClaimId: winner.claim.id.toString(),
      evaluations: summarizeEvaluations(evaluations)
    };

    const reason = winner.reasons.join(" ");
    const demoPaths = await writeDemoArtifact(artifactDir, artifact, `poidh-${this.artifactPrefix}`);
    const socialPaths = await writeSocialProofArtifact(artifactDir, {
      generatedAt: new Date().toISOString(),
      chainName: this.issuerClient.chainName,
      bountyId: bountyId.toString(),
      bountyUrl,
      bountyTitle: bounty.name,
      winnerClaimId: winner.claim.id.toString(),
      reason,
      author: process.env.SOCIAL_POST_AUTHOR?.trim(),
      post: [
        `poidh decision for bounty ${bountyId.toString()}: ${bounty.name}`,
        `winner claim: ${winner.claim.id.toString()}`,
        `reason: ${reason}`,
        `url: ${bountyUrl}`
      ].join("\n"),
      followUpAnswers: [
        {
          question: "Why did this claim win?",
          answer: reason
        },
        {
          question: "What evidence did the bot check?",
          answer: "It checked the claim tokenURI, claim metadata, resolved content type, and the submission text."
        },
        {
          question: "Was the payout handled on-chain?",
          answer: this.lastFinalActionTxHash
            ? `Yes, the final action transaction was ${this.lastFinalActionTxHash}.`
            : "The bot completed the on-chain final action during the demo."
        }
      ]
    });
    const farcasterPaths = await writeFarcasterProofArtifact(artifactDir, {
      generatedAt: new Date().toISOString(),
      chainName: this.issuerClient.chainName,
      bountyId: bountyId.toString(),
      bountyUrl,
      bountyTitle: bounty.name,
      winnerClaimId: winner.claim.id.toString(),
      cast: buildFarcasterCastDraft(
        {
          bountyId,
          bountyTitle: bounty.name,
          winningClaimId: winner.claim.id,
          reason,
          url: bountyUrl
        },
        process.env.SOCIAL_POST_AUTHOR?.trim()
      )
    });

    this.lastArtifactKey = decisionKey;
    return {
      artifact,
      demoPaths,
      socialPaths,
      farcasterPaths
    };
  }
}
