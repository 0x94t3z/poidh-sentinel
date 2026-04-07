import "server-only";
import { createPublicClient, createWalletClient, http, parseEther, type Hash } from "viem";
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
    name: "everHadExternalContributor",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
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

  const hasExternal = await publicClient.readContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "everHadExternalContributor",
    args: [bountyId],
  }) as boolean;

  if (!hasExternal) {
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
