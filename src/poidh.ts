import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseAbi,
  type Hex
} from "viem";
import type { Account } from "viem";
import { privateKeyToAccount as privateKeyToAccountFromAccounts } from "viem/accounts";
import { chainMap, contractAddresses, resolveFrontendBountyUrl } from "./chains.js";
import type { BountyTuple, ChainName, ClaimTuple, VotingTracker } from "./types.js";

const poidhAbi = parseAbi([
  "function createSoloBounty(string,string) payable",
  "function createOpenBounty(string,string) payable",
  "function createClaim(uint256,string,string,string)",
  "function acceptClaim(uint256,uint256)",
  "function submitClaimForVote(uint256,uint256)",
  "function resolveVote(uint256)",
  "function everHadExternalContributor(uint256) view returns (bool)",
  "function bountyVotingTracker(uint256) view returns (uint256,uint256,uint256)",
  "function bountyCurrentVotingClaim(uint256) view returns (uint256)",
  "function getClaimsByBountyId(uint256,uint256) view returns ((uint256,address,uint256,address,string,string,uint256,bool)[])",
  "function bounties(uint256) view returns (uint256,address,string,string,uint256,address,uint256,uint256)",
  "function poidhNft() view returns (address)",
  "function pendingWithdrawals(address) view returns (uint256)",
  "function MIN_BOUNTY_AMOUNT() view returns (uint256)",
  "function MIN_CONTRIBUTION() view returns (uint256)"
]);

const nftAbi = parseAbi(["function tokenURI(uint256) view returns (string)"]);

function normalizePrivateKey(privateKey: string): Hex {
  const trimmed = privateKey.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

export class PoidhClient {
  readonly chainName: ChainName;
  readonly contractAddress: `0x${string}`;
  readonly account: Account;
  readonly publicClient;
  readonly walletClient;

  constructor(
    chainName: ChainName,
    rpcUrl: string,
    privateKey: string
  ) {
    this.chainName = chainName;
    this.contractAddress = contractAddresses[chainName];
    this.account = privateKeyToAccountFromAccounts(normalizePrivateKey(privateKey));
    const chain = chainMap[chainName];

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl)
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain,
      transport: http(rpcUrl)
    });
  }

  async getMinBountyAmount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "MIN_BOUNTY_AMOUNT"
    }) as Promise<bigint>;
  }

  async getMinContribution(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "MIN_CONTRIBUTION"
    }) as Promise<bigint>;
  }

  async getBounty(bountyId: bigint): Promise<BountyTuple> {
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "bounties",
      args: [bountyId]
    })) as readonly [bigint, `0x${string}`, string, string, bigint, `0x${string}`, bigint, bigint];

    return {
      id: result[0],
      issuer: result[1],
      name: result[2],
      description: result[3],
      amount: result[4],
      claimer: result[5],
      createdAt: result[6],
      claimId: result[7]
    };
  }

  async getClaimsByBountyId(bountyId: bigint, offset = 0n): Promise<ClaimTuple[]> {
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "getClaimsByBountyId",
      args: [bountyId, offset]
    })) as readonly (readonly [bigint, `0x${string}`, bigint, `0x${string}`, string, string, bigint, boolean])[];

    return result.map((claim) => ({
      id: claim[0],
      issuer: claim[1],
      bountyId: claim[2],
      bountyIssuer: claim[3],
      name: claim[4],
      description: claim[5],
      createdAt: claim[6],
      accepted: claim[7]
    }));
  }

  async getAllClaims(bountyId: bigint): Promise<ClaimTuple[]> {
    const allClaims: ClaimTuple[] = [];
    let offset = 0n;

    while (true) {
      const page = await this.getClaimsByBountyId(bountyId, offset);
      allClaims.push(...page);
      if (page.length < 10) {
        break;
      }
      offset += 10n;
    }

    return allClaims;
  }

  async getNftAddress(): Promise<`0x${string}`> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "poidhNft"
    }) as Promise<`0x${string}`>;
  }

  async getTokenUri(claimId: bigint): Promise<string> {
    const nftAddress = await this.getNftAddress();
    return this.publicClient.readContract({
      address: nftAddress,
      abi: nftAbi,
      functionName: "tokenURI",
      args: [claimId]
    }) as Promise<string>;
  }

  async getTokenUris(claimIds: bigint[]): Promise<Map<bigint, string>> {
    const pairs = await Promise.all(
      claimIds.map(async (claimId) => [claimId, await this.getTokenUri(claimId)] as const)
    );
    return new Map(pairs);
  }

  async getVotingTracker(bountyId: bigint): Promise<VotingTracker> {
    const result = (await this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "bountyVotingTracker",
      args: [bountyId]
    })) as readonly [bigint, bigint, bigint];

    return {
      yesWeight: result[0],
      noWeight: result[1],
      deadline: result[2]
    };
  }

  async hasExternalContributor(bountyId: bigint): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "everHadExternalContributor",
      args: [bountyId]
    }) as Promise<boolean>;
  }

  async getCurrentVotingClaim(bountyId: bigint): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "bountyCurrentVotingClaim",
      args: [bountyId]
    }) as Promise<bigint>;
  }

  async createSoloBounty(name: string, description: string, amountWei: bigint): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "createSoloBounty",
      args: [name, description],
      value: amountWei
    });
  }

  async createOpenBounty(name: string, description: string, amountWei: bigint): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "createOpenBounty",
      args: [name, description],
      value: amountWei
    });
  }

  async createClaim(
    bountyId: bigint,
    name: string,
    description: string,
    proofUri: string
  ): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "createClaim",
      args: [bountyId, name, description, proofUri]
    });
  }

  async acceptClaim(bountyId: bigint, claimId: bigint): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "acceptClaim",
      args: [bountyId, claimId]
    });
  }

  async submitClaimForVote(bountyId: bigint, claimId: bigint): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "submitClaimForVote",
      args: [bountyId, claimId]
    });
  }

  async resolveVote(bountyId: bigint): Promise<`0x${string}`> {
    return this.walletClient.writeContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "resolveVote",
      args: [bountyId]
    });
  }

  async getPendingWithdrawals(address: `0x${string}` = this.account.address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.contractAddress,
      abi: poidhAbi,
      functionName: "pendingWithdrawals",
      args: [address]
    }) as Promise<bigint>;
  }

  async waitForReceipt(hash: `0x${string}`) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  async createBounty(kind: "solo" | "open", name: string, description: string, amountWei: bigint) {
    const hash =
      kind === "solo"
        ? await this.createSoloBounty(name, description, amountWei)
        : await this.createOpenBounty(name, description, amountWei);

    const receipt = await this.waitForReceipt(hash);
    const bountyId = await this.extractBountyIdFromReceipt(hash);

    return {
      hash,
      receipt,
      bountyId,
      issuerAddress: this.account.address,
      url: resolveFrontendBountyUrl(this.chainName, bountyId)
    };
  }

  async extractBountyIdFromReceipt(hash: `0x${string}`): Promise<bigint> {
    const receipt = await this.publicClient.getTransactionReceipt({ hash });
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === this.contractAddress.toLowerCase() && log.topics.length >= 2) {
        return BigInt(log.topics[1] ?? "0x0");
      }
    }
    throw new Error(`Could not extract bounty id from receipt ${hash}`);
  }

  async extractClaimIdFromReceipt(hash: `0x${string}`): Promise<bigint> {
    const receipt = await this.publicClient.getTransactionReceipt({ hash });
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === this.contractAddress.toLowerCase() && log.topics.length >= 2) {
        return BigInt(log.topics[1] ?? "0x0");
      }
    }
    throw new Error(`Could not extract claim id from receipt ${hash}`);
  }

  formatAmount(wei: bigint): string {
    return `${formatEther(wei)} ${this.chainName === "degen" ? "DEGEN" : "ETH"}`;
  }
}
