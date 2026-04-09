import "server-only";
import { createPublicClient, createWalletClient, http, parseEther, formatEther, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum, base } from "viem/chains";

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
    name: "participants",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }, { name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "bountyContributions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{
      name: "",
      type: "tuple[]",
      components: [
        { name: "contributor", type: "address" },
        { name: "amount", type: "uint256" },
      ],
    }],
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

function getViemChain(chain: string) {
  if (chain === "base") return base;
  return arbitrum; // default + "arbitrum"
}

function getRpcUrl(chain: string): string {
  if (chain === "base") return process.env.BASE_RPC_URL ?? "https://mainnet.base.org";
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

// Create an OPEN bounty on the specified chain
export async function createBountyOnChain(
  name: string,
  description: string,
  amountEth = "0.001",
  chain = "arbitrum",
): Promise<{ txHash: Hash; bountyId: string | null }> {
  const { client, account } = getWalletClient(chain);
  const publicClient = getPublicClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;
  const value = parseEther(amountEth);

  const txHash = await client.writeContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "createOpenBounty",
    args: [name, description],
    value,
    account,
  });

  let bountyId: string | null = null;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });

    // Extract bountyId from first matching log — topics[1] is the indexed bounty ID
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === contractAddress.toLowerCase() && log.topics.length >= 2 && log.topics[1]) {
        bountyId = BigInt(log.topics[1]).toString();
        break;
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

export async function resolveBountyWinner(
  bountyId: bigint,
  claimId: bigint,
  chain = "arbitrum",
): Promise<{ txHash: Hash; method: "direct" | "vote_submitted" | "vote_resolved" }> {
  const publicClient = getPublicClient(chain);
  const { client, account } = getWalletClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;

  // Determine bounty type: solo (no participants → acceptClaim directly) vs
  // open (participants array populated via createOpenBounty → submitClaimForVote/resolveVote).
  // The contract does NOT have everHadExternalContributor — use participants[bountyId][0] probe.
  let isOpenBounty = false;
  try {
    await publicClient.readContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "participants",
      args: [bountyId, BigInt(0)],
    });
    isOpenBounty = true; // didn't revert → at least one participant → open bounty
  } catch {
    isOpenBounty = false; // reverted → no participants → solo bounty
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

// Resolve a Farcaster FID to a verified custody address via Neynar
async function resolveFidToCustodyAddress(fid: number): Promise<string | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: { "x-api-key": apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json() as { users?: Array<{ custody_address?: string; verified_addresses?: { eth_addresses?: string[] } }> };
    const user = data.users?.[0];
    if (!user) return null;
    // Prefer first verified ETH address, fall back to custody address
    return user.verified_addresses?.eth_addresses?.[0] ?? user.custody_address ?? null;
  } catch {
    return null;
  }
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
  creatorFid?: number,
  bountyAmountWei?: bigint, // exact bounty reward from DB — preferred over pendingWithdrawals delta
): Promise<{ cancelTxHash: string; withdrawTxHash: string; refundTxHash?: string; method: "cancelSoloBounty" | "cancelOpenBounty"; refundAddress: string; externalContributors: string[] }> {
  const publicClient = getPublicClient(chain);
  const { client, account } = getWalletClient(chain);
  const contractAddress = POIDH_CONTRACTS[chain] ?? POIDH_CONTRACT;

  // Probe participants[bountyId][0] to determine solo vs open
  let isOpen = false;
  try {
    await publicClient.readContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "participants",
      args: [bountyId, BigInt(0)],
    });
    isOpen = true;
  } catch {
    isOpen = false;
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

  // For open bounties: bot must first call claimRefundFromCancelledOpenBounty
  // to move its own contribution into pendingWithdrawals[botWallet]
  if (isOpen) {
    const claimRefundTx = await client.writeContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "claimRefundFromCancelledOpenBounty",
      args: [bountyId],
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: claimRefundTx, timeout: 60_000 });
    console.log(`[poidh-contract] claimRefundFromCancelledOpenBounty bountyId=${bountyId}: ${claimRefundTx}`);
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

  // Step 1: withdraw the full pendingWithdrawals[botWallet] balance back to the bot wallet.
  // withdraw() pulls everything — we then send exactly bountyRefundAmount to the creator,
  // which preserves any pre-existing balance in the bot wallet.
  const withdrawTxHash = await client.writeContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "withdraw",
    args: [],
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: withdrawTxHash, timeout: 60_000 });
  console.log(`[poidh-contract] withdraw to bot wallet: ${withdrawTxHash}`);

  // Step 2: plain ETH transfer from bot wallet → creator wallet for exactly bountyRefundAmount.
  // The poidh contract has no record of the original depositor — refund is outside the contract.
  const creatorAddress = creatorFid ? await resolveFidToCustodyAddress(creatorFid) : null;
  const refundAddress = creatorAddress ?? account.address;

  let refundTxHash: string | undefined;
  if (creatorAddress && creatorAddress.toLowerCase() !== account.address.toLowerCase()) {
    refundTxHash = await client.sendTransaction({
      to: creatorAddress as `0x${string}`,
      value: bountyRefundAmount,
      account,
    });
    await publicClient.waitForTransactionReceipt({ hash: refundTxHash as `0x${string}`, timeout: 60_000 });
    console.log(`[poidh-contract] refund ${formatEther(bountyRefundAmount)} ETH sent to creator ${creatorAddress} (FID ${creatorFid}): ${refundTxHash}`);
  } else {
    console.warn(`[poidh-contract] no creator address resolved for FID ${creatorFid} — ${formatEther(bountyRefundAmount)} ETH stays in bot wallet`);
  }

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
