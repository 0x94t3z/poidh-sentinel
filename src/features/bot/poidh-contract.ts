import "server-only";
import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Hash, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, base, degen } from "viem/chains";

// Contract addresses per chain
export const POIDH_CONTRACTS: Record<string, `0x${string}`> = {
  arbitrum: "0x5555Fa783936C260f77385b4E153B9725feF1719",
  base:     "0x5555Fa783936C260f77385b4E153B9725feF1719",
  degen:    "0x18E5585ca7cE31b90Bc8BB7aAf84152857cE243f",
};

// Keep POIDH_CONTRACT as the default (arbitrum/base) for backwards compat
export const POIDH_CONTRACT = "0x5555Fa783936C260f77385b4E153B9725feF1719" as const;

// poidh.xyz uses a per-chain offset on top of the raw contract bounty ID
export const POIDH_FRONTEND_OFFSETS: Record<string, number> = {
  arbitrum: 180,
  base:     986,
  degen:    1197,
};

export function resolvePoidhUrl(chain: string, rawBountyId: string): string {
  const slug = chain === "base" ? "base" : chain === "degen" ? "degen" : "arbitrum";
  const offset = POIDH_FRONTEND_OFFSETS[slug] ?? 0;
  const displayId = BigInt(rawBountyId) + BigInt(offset);
  return `https://poidh.xyz/${slug}/bounty/${displayId}`;
}

export const POIDH_ABI = [
  {
    name: "createOpenBounty",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "createSoloBounty",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "bounties",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "issuer", type: "address" },
      { name: "name", type: "string" },
      { name: "description", type: "string" },
      { name: "amount", type: "uint256" },
      { name: "claimer", type: "address" },
      { name: "createdAt", type: "uint256" },
      { name: "claimId", type: "uint256" },
    ],
  },
  {
    name: "getClaimsByBountyId",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "cursor", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "issuer", type: "address" },
          { name: "bountyId", type: "uint256" },
          { name: "bountyIssuer", type: "address" },
          { name: "name", type: "string" },
          { name: "description", type: "string" },
          { name: "createdAt", type: "uint256" },
          { name: "accepted", type: "bool" },
        ],
      },
    ],
  },
  {
    // Returns true if any external contributor (not the issuer) has ever joined this bounty.
    // Use this to decide acceptClaim (false) vs submitClaimForVote (true).
    // Works on both arbitrum/base (0x5555...) and degen (0x18E5...) — same selector 0xb04f5ebd.
    name: "everHadExternalContributor",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "participants",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }, { name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "submitClaimForVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "claimId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "bountyCurrentVotingClaim",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "bountyVotingTracker",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [
      { name: "yesVotes", type: "uint256" },
      { name: "noVotes", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  {
    name: "resolveVote",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "acceptClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "claimId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelSoloBounty",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelOpenBounty",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  // Pull payment pattern — pendingWithdrawals credited by acceptClaim/resolveVote/cancelSoloBounty
  {
    name: "pendingWithdrawals",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    // Pulls pendingWithdrawals[msg.sender] to caller (winner payout or solo bounty issuer refund)
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    // Pulls pendingWithdrawals[msg.sender] to arbitrary address — useful for contract wallets
    // NOTE: bot uses plain sendTransaction() for creator refunds, not withdrawTo()
    name: "withdrawTo",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
  {
    // Contributor withdraws their share from a live open bounty (before cancel)
    name: "withdrawFromOpenBounty",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  {
    // Contributor claims their refund AFTER cancelOpenBounty — NOT automatic, must be called per-contributor
    name: "claimRefundFromCancelledOpenBounty",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "poidhNft",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "bountyCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "BountyCreated",
    type: "event",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "description", type: "string", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

// Minimal ABI for the poidh NFT contract (separate from the bounty contract)
const POIDH_NFT_ABI = [
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

// Cache nft contract address per chain to avoid repeated calls
const nftAddressCache: Record<string, `0x${string}`> = {};

async function getPoidhNftAddress(chain: string): Promise<`0x${string}` | null> {
  if (nftAddressCache[chain]) return nftAddressCache[chain];
  try {
    const publicClient = getPublicClient(chain);
    const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;
    const nftAddress = await publicClient.readContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "poidhNft",
      args: [],
    }) as `0x${string}`;
    nftAddressCache[chain] = nftAddress;
    console.log(`[poidh-contract] nft contract on ${chain}: ${nftAddress}`);
    return nftAddress;
  } catch (err) {
    console.warn(`[poidh-contract] could not get poidhNft address on ${chain}:`, err);
    return null;
  }
}

// Shared block explorer URL builder — used by webhook, deposit-checker, and bounty-loop
export function getTxExplorerUrl(chain: string, txHash: string): string {
  if (chain === "base") return `https://basescan.org/tx/${txHash}`;
  if (chain === "degen") return `https://explorer.degen.tips/tx/${txHash}`;
  return `https://arbiscan.io/tx/${txHash}`;
}

function getViemChain(chain: string) {
  if (chain === "base") return base;
  if (chain === "degen") return degen;
  return arbitrum; // default + "arbitrum"
}

function getRpcUrl(chain: string): string {
  if (chain === "base") return process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
  if (chain === "degen") return process.env.DEGEN_RPC_URL ?? "https://rpc.degen.tips";
  return process.env.ARBITRUM_RPC_URL ?? "https://arb1.arbitrum.io/rpc";
}

function getWalletAccount() {
  const privateKey = process.env.BOT_WALLET_PRIVATE_KEY;
  if (!privateKey) throw new Error("BOT_WALLET_PRIVATE_KEY is not set");
  const normalized = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  return privateKeyToAccount(normalized as `0x${string}`);
}

export function getPublicClient(chain = "arbitrum") {
  return createPublicClient({
    chain: getViemChain(chain),
    transport: http(getRpcUrl(chain)),
  });
}

export function getWalletClient(chain = "arbitrum") {
  const account = getWalletAccount();
  return {
    client: createWalletClient({
      account,
      chain: getViemChain(chain),
      transport: http(getRpcUrl(chain)),
    }),
    account,
  };
}

export function getBotWalletAddress(): string {
  try {
    return getWalletAccount().address;
  } catch {
    return "not configured";
  }
}

// Create a bounty on the specified chain.
// bountyType "open" (default) = createOpenBounty — anyone can contribute, community votes on winner.
// bountyType "solo" = createSoloBounty — issuer decides winner directly via acceptClaim, no vote.
export async function createBountyOnChain(
  name: string,
  description: string,
  amountEth = "0.001",
  chain = "arbitrum",
  bountyType: "open" | "solo" = "open",
): Promise<{ txHash: Hash; bountyId: string | null }> {
  const { client, account } = getWalletClient(chain);
  const publicClient = getPublicClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;
  const value = parseEther(amountEth);

  const txHash = await client.writeContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: bountyType === "solo" ? "createSoloBounty" : "createOpenBounty",
    args: [name, description],
    value,
    account,
  });

  let bountyId: string | null = null;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

    // BountyCreated(uint256 indexed id, address indexed issuer, string name, string description, uint256 amount)
    // topics[0] = event signature hash, topics[1] = id (bountyId), topics[2] = issuer address
    // Match on event signature to avoid accidentally reading the wrong log (e.g. OpenBountyJoined)
    const BOUNTY_CREATED_SIG = keccak256(toBytes("BountyCreated(uint256,address,string,string,uint256)"));
    for (const log of receipt.logs) {
      if (
        log.address.toLowerCase() === contractAddress.toLowerCase() &&
        log.topics[0] === BOUNTY_CREATED_SIG &&
        log.topics[1]
      ) {
        bountyId = BigInt(log.topics[1]).toString();
        break;
      }
    }

    // Fallback: if signature match fails (unlikely), grab first log with 2+ topics from the contract
    if (!bountyId) {
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === contractAddress.toLowerCase() && log.topics.length >= 2 && log.topics[1]) {
          bountyId = BigInt(log.topics[1]).toString();
          console.warn(`[poidh-contract] BountyCreated sig not matched — fell back to first log topic for ${txHash}`);
          break;
        }
      }
    }

    if (bountyId) {
      console.log(`[poidh-contract] raw bountyId=${bountyId} on ${chain} → url: ${resolvePoidhUrl(chain, bountyId)}`);
    } else {
      console.warn(`[poidh-contract] could not extract bountyId from receipt logs for ${txHash}`);
    }
  } catch (err) {
    console.warn("[poidh-contract] could not get bounty ID from receipt:", err);
  }

  return { txHash, bountyId };
}

export async function getClaimsForBounty(bountyId: bigint, chain = "arbitrum") {
  const publicClient = getPublicClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;
  const allClaims: Array<{
    id: bigint;
    issuer: string;
    bountyId: bigint;
    bountyIssuer: string;
    name: string;
    description: string;
    createdAt: bigint;
    accepted: boolean;
  }> = [];

  // Contract always returns exactly 10 slots, padding with zero-structs when fewer claims exist.
  // cursor is an index offset. We fetch pages until we see a full page of zeros.
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  for (let page = 0; page < 10; page++) {
    const cursor = BigInt(page * 10);
    let claimsArr: typeof allClaims;
    try {
      const claims = await publicClient.readContract({
        address: contractAddress,
        abi: POIDH_ABI,
        functionName: "getClaimsByBountyId",
        args: [bountyId, cursor],
      });
      claimsArr = claims as typeof allClaims;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 120) : String(err);
      console.warn(`[poidh-contract] getClaimsByBountyId(${bountyId}, ${cursor}) reverted: ${msg}`);
      break;
    }

    // Filter out zero-padded slots (id=0 and zero issuer address)
    const realClaims = claimsArr.filter((c) => c.id > BigInt(0) && c.issuer !== ZERO_ADDR);
    allClaims.push(...realClaims);

    // If we got fewer real claims than the page size, we've seen all claims
    if (realClaims.length < 10) break;
  }

  // Enrich each claim with its tokenURI — lives on the separate poidh NFT contract
  const nftAddress = await getPoidhNftAddress(chain);
  const enriched = await Promise.all(
    allClaims.map(async (c) => {
      let uri = "";
      if (nftAddress) {
        try {
          uri = await publicClient.readContract({
            address: nftAddress,
            abi: POIDH_NFT_ABI,
            functionName: "tokenURI",
            args: [c.id],
          }) as string;
        } catch {
          // tokenURI not available for this claim
        }
      }
      return { ...c, uri };
    }),
  );

  return enriched;
}

// Fetch the issuer address of a specific claim by scanning getClaimsByBountyId pages.
// Used to backfill winnerIssuer for old bounties that were closed before we persisted it.
export async function getClaimIssuer(bountyId: bigint, claimId: bigint, chain = "arbitrum"): Promise<string | null> {
  const publicClient = getPublicClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;
  const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
  for (let page = 0; page < 10; page++) {
    const cursor = BigInt(page * 10);
    try {
      const claims = await publicClient.readContract({
        address: contractAddress,
        abi: POIDH_ABI,
        functionName: "getClaimsByBountyId",
        args: [bountyId, cursor],
      }) as unknown as Array<{ id: bigint; issuer: string }>;
      const real = claims.filter((c) => c.id > BigInt(0) && c.issuer !== ZERO_ADDR);
      const match = real.find((c) => c.id === claimId);
      if (match) return match.issuer;
      if (real.length < 10) break; // no more pages
    } catch {
      break;
    }
  }
  return null;
}

export async function resolveBountyWinner(
  bountyId: bigint,
  claimId: bigint,
  chain = "arbitrum",
): Promise<{ txHash: Hash; method: "direct" | "vote_submitted" | "vote_resolved" }> {
  const publicClient = getPublicClient(chain);
  const { client, account } = getWalletClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;

  // Determine bounty type: use everHadExternalContributor — canonical check on both
  // arbitrum/base and degen. Returns true if any external (non-issuer) contributor has
  // ever joined → use submitClaimForVote/resolveVote. False → use acceptClaim directly.
  let isOpenBounty = false;
  try {
    isOpenBounty = await publicClient.readContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "everHadExternalContributor",
      args: [bountyId],
    }) as boolean;
  } catch {
    isOpenBounty = false; // if it reverts for any reason, fall back to solo path
  }

  if (!isOpenBounty) {
    const txHash = await client.writeContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "acceptClaim",
      args: [bountyId, claimId],
      account,
    });
    return { txHash, method: "direct" };
  }

  const currentVotingClaim = await publicClient.readContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "bountyCurrentVotingClaim",
    args: [bountyId],
  }) as bigint;

  if (currentVotingClaim === BigInt(0)) {
    const txHash = await client.writeContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "submitClaimForVote",
      args: [bountyId, claimId],
      account,
    });
    return { txHash, method: "vote_submitted" };
  }

  const tracker = await publicClient.readContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "bountyVotingTracker",
    args: [bountyId],
  }) as [bigint, bigint, bigint];

  const deadline = tracker[2];
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (now >= deadline) {
    const txHash = await client.writeContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "resolveVote",
      args: [bountyId],
      account,
    });
    return { txHash, method: "vote_resolved" };
  }

  const hoursLeft = Number((deadline - now) / BigInt(3600));
  throw new Error(`vote in progress, ${hoursLeft}h remaining until resolution`);
}

// Cancel a bounty the bot created — uses cancelSoloBounty or cancelOpenBounty.
//
// REFUND MECHANICS (verified from contract ABI):
//
// cancelSoloBounty:
//   → credits pendingWithdrawals[botWallet]
//   → bot calls withdraw() to pull ETH back to bot wallet
//   → bot calls sendTransaction(creatorAddress, amount) — plain ETH transfer to the person who funded it
//     (the poidh contract has no record of the original depositor; refund is outside the contract)
//
// cancelOpenBounty:
//   → does NOT auto-refund anyone
//   → bot calls claimRefundFromCancelledOpenBounty(bountyId) to recover its own issuer contribution
//     into pendingWithdrawals[botWallet], then withdraw() + sendTransaction(creatorAddress)
//   → all OTHER contributors must call claimRefundFromCancelledOpenBounty(bountyId) themselves
//     on poidh.xyz — requires their own msg.sender, bot cannot do it for them
//
// withdraw / withdrawTo pull from pendingWithdrawals[msg.sender] — same mechanism used for
// winner payouts from acceptClaim/resolveVote. withdrawTo is NOT used for creator refunds.
export async function cancelBounty(
  bountyId: bigint,
  chain = "arbitrum",
  creatorRefundAddress?: string | null, // pre-resolved creator wallet — caller must validate before passing
  bountyAmountWei?: bigint, // exact bounty reward from DB — preferred over pendingWithdrawals delta
  bountyType?: "open" | "solo" | null, // DB bountyType — used as fallback when contract read fails
): Promise<{ cancelTxHash: string; withdrawTxHash: string; refundTxHash?: string; method: "cancelSoloBounty" | "cancelOpenBounty"; refundAddress: string; externalContributors: string[] }> {
  const publicClient = getPublicClient(chain);
  const { client, account } = getWalletClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;

  // Determine cancel path.
  // DB bountyType is authoritative when present:
  // - open -> cancelOpenBounty
  // - solo -> cancelSoloBounty
  //
  // Rationale: open bounties can still have zero external contributors at cancel time,
  // so everHadExternalContributor=false does NOT imply solo.
  let isOpen: boolean;
  if (bountyType === "open" || bountyType === "solo") {
    isOpen = bountyType === "open";
    console.log(
      `[poidh-contract] cancelBounty: using DB bountyType=${bountyType} for bountyId=${bountyId} chain=${chain} -> isOpen=${isOpen}`,
    );
  } else {
    // Legacy/unknown rows: fall back to contract signal.
    try {
      isOpen = await publicClient.readContract({
        address: contractAddress,
        abi: POIDH_ABI,
        functionName: "everHadExternalContributor",
        args: [bountyId],
      }) as boolean;
    } catch {
      // Conservative fallback for unknown rows: assume solo path.
      isOpen = false;
      console.warn(
        `[poidh-contract] cancelBounty: could not resolve type for bountyId=${bountyId} chain=${chain}, defaulting to solo cancel path`,
      );
    }
  }

  // Snapshot pendingWithdrawals BEFORE cancel — so we can isolate exactly what was credited by this cancel
  const pendingBefore = await publicClient.readContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "pendingWithdrawals",
    args: [account.address],
  }) as bigint;

  const functionName = isOpen ? "cancelOpenBounty" : "cancelSoloBounty";
  const cancelTxHash = await client.writeContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName,
    args: [bountyId],
    account,
  });

  // Wait for cancel tx to be mined
  await publicClient.waitForTransactionReceipt({ hash: cancelTxHash, timeout: 60_000 });

  // For open bounties: best-effort claim of issuer refund from cancelled bounty.
  // Some contract states already credit the issuer, or the claim may have been
  // executed in a previous attempt. In those cases this call can revert even
  // though cancellation succeeded, so treat it as recoverable.
  let claimRefundTxHash: string | undefined;
  if (isOpen) {
    try {
      claimRefundTxHash = await client.writeContract({
        address: contractAddress,
        abi: POIDH_ABI,
        functionName: "claimRefundFromCancelledOpenBounty",
        args: [bountyId],
        account,
      });
      await publicClient.waitForTransactionReceipt({ hash: claimRefundTxHash, timeout: 60_000 });
      console.log(`[poidh-contract] claimRefundFromCancelledOpenBounty bountyId=${bountyId}: ${claimRefundTxHash}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[poidh-contract] claimRefundFromCancelledOpenBounty failed for bountyId=${bountyId} chain=${chain}: ${msg}`,
      );
    }
  }

  // Read pendingWithdrawals AFTER cancel — the delta is exactly what this bounty credited
  const pendingAfter = await publicClient.readContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "pendingWithdrawals",
    args: [account.address],
  }) as bigint;

  // Compute delta for sanity logging — how much this cancel actually credited
  const deltaAmount = pendingAfter > pendingBefore ? pendingAfter - pendingBefore : BigInt(0);

  // Use stored bounty amount (from DB) as the definitive refund amount.
  // This is the exact bounty reward the creator put up — no fee, no over/under.
  // Fall back to the delta if no stored amount was provided (shouldn't happen in normal flow).
  const bountyRefundAmount = bountyAmountWei ?? deltaAmount;

  console.log(
    `[poidh-contract] cancelBounty: pendingBefore=${formatEther(pendingBefore)} ` +
    `pendingAfter=${formatEther(pendingAfter)} delta=${formatEther(deltaAmount)} ` +
    `refundAmount=${formatEther(bountyRefundAmount)} (${bountyAmountWei ? "from DB" : "from delta"})`,
  );

  if (bountyRefundAmount === BigInt(0)) {
    console.warn(`[poidh-contract] cancelBounty: refund amount is zero for bountyId=${bountyId} — nothing to withdraw`);
    return { cancelTxHash, withdrawTxHash: cancelTxHash, refundTxHash: undefined, method: functionName, refundAddress: account.address, externalContributors: [] };
  }

  // Step 1: withdraw pendingWithdrawals if there is any balance to pull.
  // If none is pending (e.g. already withdrawn earlier or issuer credited directly),
  // skip this step and continue to plain wallet refund transfer.
  let withdrawTxHash = cancelTxHash;
  if (pendingAfter > BigInt(0)) {
    withdrawTxHash = await client.writeContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "withdraw",
      args: [],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: withdrawTxHash, timeout: 60_000 });
    console.log(`[poidh-contract] withdraw to bot wallet: ${withdrawTxHash}`);
  } else {
    console.log(
      `[poidh-contract] cancelBounty: pendingWithdrawals is zero after cancel for bountyId=${bountyId}; skipping withdraw`,
    );
  }

  // Step 2: plain native token transfer from bot wallet → creator wallet for exactly bountyRefundAmount.
  // ETH on arbitrum/base, DEGEN on degen chain. The poidh contract has no record of the original
  // depositor — refund is a direct sendTransaction outside the contract.
  //
  // SAFETY INVARIANT: we NEVER send to the bot wallet address as a "refund".
  // creatorRefundAddress is pre-resolved by the webhook before the confirmation prompt.
  // If it was null/empty the cancel is blocked upstream — but we guard here too just in case.
  const nativeCurrency = chain === "degen" ? "DEGEN" : "ETH";

  const isValidRefundTarget =
    creatorRefundAddress &&
    creatorRefundAddress.startsWith("0x") &&
    creatorRefundAddress.length === 42 &&
    creatorRefundAddress.toLowerCase() !== account.address.toLowerCase();

  if (!isValidRefundTarget) {
    // This should never happen in normal flow — means the caller didn't validate upfront.
    // Do NOT send to bot wallet. Hold the funds and surface the error clearly.
    console.error(
      `[poidh-contract] SAFETY BLOCK: refusing to send refund — invalid or bot-wallet address: "${creatorRefundAddress}". ` +
      `${formatEther(bountyRefundAmount)} ${nativeCurrency} stays in bot wallet pending manual resolution.`
    );
    return {
      cancelTxHash,
      withdrawTxHash,
      refundTxHash: undefined,
      method: functionName,
      refundAddress: creatorRefundAddress ?? account.address,
      externalContributors: [],
    };
  }

  const refundAddress = creatorRefundAddress;
  let refundTxHash: string | undefined;

  refundTxHash = await client.sendTransaction({
    to: refundAddress as `0x${string}`,
    value: bountyRefundAmount,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: refundTxHash as `0x${string}`, timeout: 60_000 });
  console.log(`[poidh-contract] refund ${formatEther(bountyRefundAmount)} ${nativeCurrency} sent to ${refundAddress}: ${refundTxHash}`);

  // Collect external contributor addresses (all participants except the bot itself)
  // These must claim their own refund on poidh.xyz via claimRefundFromCancelledOpenBounty
  const externalContributors: string[] = [];
  if (isOpen) {
    const ZERO_ADDR = "0x0000000000000000000000000000000000000000";
    for (let i = 0; i < 50; i++) {
      try {
        const addr = await publicClient.readContract({
          address: contractAddress,
          abi: POIDH_ABI,
          functionName: "participants",
          args: [bountyId, BigInt(i)],
        }) as string;
        if (addr && addr !== ZERO_ADDR && addr.toLowerCase() !== account.address.toLowerCase()) {
          externalContributors.push(addr);
        }
      } catch {
        break;
      }
    }
  }

  if (claimRefundTxHash) {
    console.log(`[poidh-contract] cancelBounty: claimRefund tx observed ${claimRefundTxHash}`);
  }

  return { cancelTxHash, withdrawTxHash, refundTxHash, method: functionName, refundAddress, externalContributors };
}

export async function getBountyDetails(bountyId: bigint, chain = "arbitrum") {
  const publicClient = getPublicClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;
  const result = await publicClient.readContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "bounties",
    args: [bountyId],
  });

  const [id, issuer, name, description, amount, claimer, createdAt, claimId] = result as [
    bigint, string, string, string, bigint, string, bigint, bigint
  ];

  return { id, issuer, name, description, amount, claimer, createdAt, claimId };
}
