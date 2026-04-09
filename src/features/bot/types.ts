export type BountyAction =
  | "suggest_bounty"
  | "evaluate_submission"
  | "pick_winner"
  | "general_reply"
  | "create_bounty"
  | "create_bounty_onchain"
  | "wallet_address";

export interface WebhookCastData {
  hash: string;
  thread_hash: string;
  parent_hash: string | null;
  author: {
    fid: number;
    username: string;
    display_name: string;
  };
  text: string;
  timestamp: string;
  mentioned_profiles?: Array<{ fid: number; username: string }>;
  embeds?: Array<{ url?: string; cast_id?: { fid: number; hash: string } }>;
}

export interface WebhookPayload {
  created_at: number;
  type: "cast.created";
  data: WebhookCastData;
}

export interface AgentContext {
  castHash: string;
  threadHash: string;
  authorUsername: string;
  authorFid: number;
  castText: string;
  action: BountyAction;
  replyToBot?: boolean;
  mentioned?: boolean;    // true when @poidh-sentinel was explicitly tagged in the cast
  imageUrls?: string[];   // image embeds found in the cast or its parent
  bountyContext?: {
    bountyId?: string;
    name: string;
    description: string;
    chain: string;
    poidhUrl?: string;
    winnerClaimId?: string;
    winnerIssuer?: string;
    winnerReasoning?: string;
    // Per-claim evaluation results — used to explain rejections in thread replies
    // issuer = EVM wallet address of submitter; issuerUsername = resolved @farcaster handle
    allEvalResults?: Array<{ claimId: string; score: number; valid: boolean; reasoning: string; issuer?: string; issuerUsername?: string }>;
  };
}

export interface AgentResponse {
  reply: string;
  action: BountyAction;
  suggestedIdea?: {
    name: string;
    description: string;
  };
  onChainBounty?: {
    name: string;
    description: string;
    amountEth: string;
  };
}

export interface BotLogEntry {
  id: string;
  timestamp: string;
  triggerCastHash: string;
  triggerAuthor: string;
  triggerText: string;
  action: string; // BountyAction or any string logged by cron/deposit-checker
  replyText: string;
  status: "success" | "error";
  errorMessage?: string;
  txHash?: string;
}
