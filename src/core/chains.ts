import { arbitrum, base, type Chain } from "viem/chains";
import type { ChainName } from "./types.js";

export const degen: Chain = {
  id: 666666666,
  name: "Degen Chain",
  nativeCurrency: { name: "DEGEN", symbol: "DEGEN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.degen.tips"] },
    public: { http: ["https://rpc.degen.tips"] }
  },
  blockExplorers: {
    default: { name: "Degen Explorer", url: "https://explorer.degen.tips" }
  }
};

export const chainMap: Record<ChainName, Chain> = {
  arbitrum,
  base,
  degen
};

export const contractAddresses: Record<ChainName, `0x${string}`> = {
  arbitrum: "0x5555Fa783936C260f77385b4E153B9725feF1719",
  base: "0x5555Fa783936C260f77385b4E153B9725feF1719",
  degen: "0x18E5585ca7cE31b90Bc8BB7aAf84152857cE243f"
};

export const frontendOffsets: Record<ChainName, number> = {
  arbitrum: 180,
  base: 986,
  degen: 1197
};

export function resolveFrontendBountyUrl(chain: ChainName, bountyId: bigint): string {
  const offset = frontendOffsets[chain];
  return `https://poidh.xyz/${chain}/bounty/${bountyId + BigInt(offset)}`;
}
