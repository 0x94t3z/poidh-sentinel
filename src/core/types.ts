export type ChainName = "arbitrum" | "base" | "degen";

export type ClaimTuple = {
  id: bigint;
  issuer: `0x${string}`;
  bountyId: bigint;
  bountyIssuer: `0x${string}`;
  name: string;
  description: string;
  createdAt: bigint;
  accepted: boolean;
};

export type BountyTuple = {
  id: bigint;
  issuer: `0x${string}`;
  name: string;
  description: string;
  amount: bigint;
  claimer: `0x${string}`;
  createdAt: bigint;
  claimId: bigint;
};

export type VotingTracker = {
  yesWeight: bigint;
  noWeight: bigint;
  deadline: bigint;
};

export type ClaimEvidence = {
  tokenUri: string;
  contentUri: string;
  contentType: string;
  title?: string;
  text: string;
  ocrText?: string;
  imageUrl?: string;
  animationUrl?: string;
  rawMetadata?: unknown;
};

export type ClaimEvaluation = {
  claim: ClaimTuple;
  score: number;
  reasons: string[];
  evidence: ClaimEvidence;
  visionSummary?: string;
  visionSignals?: string[];
};
