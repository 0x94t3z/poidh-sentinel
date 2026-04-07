import {
  mainnet,
  sepolia,
  base,
  baseSepolia,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  polygon,
  zora,
  gnosis,
  celo,
  degen,
  unichain,
  monadTestnet,
  Chain,
} from "viem/chains";

type FarcasterSupportedChainInfo = {
  chain: Chain;
  iconUrl?: string;
};

type FarcasterSupportedChains = {
  [key: number]: FarcasterSupportedChainInfo;
};

export const farcasterSupportedChainsById = {
  [mainnet.id]: {
    chain: mainnet,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  },
  [sepolia.id]: {
    chain: sepolia,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
  },
  [base.id]: {
    chain: base,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
  },
  [baseSepolia.id]: {
    chain: baseSepolia,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
  },
  [arbitrum.id]: {
    chain: arbitrum,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  },
  [arbitrumSepolia.id]: {
    chain: arbitrumSepolia,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png",
  },
  [optimism.id]: {
    chain: optimism,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  },
  [optimismSepolia.id]: {
    chain: optimismSepolia,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png",
  },
  [polygon.id]: {
    chain: polygon,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png",
  },
  [zora.id]: {
    chain: zora,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zora/info/logo.png",
  },
  [degen.id]: {
    chain: degen,
    iconUrl: "https://icons.llamao.fi/icons/chains/rsz_degen.jpg",
  },
  [gnosis.id]: {
    chain: gnosis,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xdai/info/logo.png",
  },
  [unichain.id]: {
    chain: unichain,
    iconUrl: "https://icons.llamao.fi/icons/chains/rsz_unichain.jpg",
  },
  [monadTestnet.id]: {
    chain: monadTestnet,
    iconUrl: "https://icons.llamao.fi/icons/chains/rsz_monad.jpg",
  },
  [celo.id]: {
    chain: celo,
    iconUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/celo/info/logo.png",
  },
} as const satisfies FarcasterSupportedChains;

export type SupportedChainId = keyof typeof farcasterSupportedChainsById;

export const farcasterSupportedChainsByName = {
  mainnet: farcasterSupportedChainsById[mainnet.id],
  sepolia: farcasterSupportedChainsById[sepolia.id],
  base: farcasterSupportedChainsById[base.id],
  baseSepolia: farcasterSupportedChainsById[baseSepolia.id],
  arbitrum: farcasterSupportedChainsById[arbitrum.id],
  arbitrumSepolia: farcasterSupportedChainsById[arbitrumSepolia.id],
  optimism: farcasterSupportedChainsById[optimism.id],
  optimismSepolia: farcasterSupportedChainsById[optimismSepolia.id],
  polygon: farcasterSupportedChainsById[polygon.id],
  zora: farcasterSupportedChainsById[zora.id],
  degen: farcasterSupportedChainsById[degen.id],
  gnosis: farcasterSupportedChainsById[gnosis.id],
  unichain: farcasterSupportedChainsById[unichain.id],
  monadTestnet: farcasterSupportedChainsById[monadTestnet.id],
  celo: farcasterSupportedChainsById[celo.id],
} as const;

export type SupportedChainName = keyof typeof farcasterSupportedChainsByName;

export type ChainIdentifier = SupportedChainName | SupportedChainId | Chain;

export function getChainInfo(
  chain: ChainIdentifier,
): FarcasterSupportedChainInfo {
  if (isSupportedChainId(chain)) return farcasterSupportedChainsById[chain];
  if (isSupportedChainName(chain)) return farcasterSupportedChainsByName[chain];

  return farcasterSupportedChainsById[(chain as Chain).id as SupportedChainId];
}

function isSupportedChainId(chain: ChainIdentifier): chain is SupportedChainId {
  return typeof chain === "number";
}

function isSupportedChainName(
  chain: ChainIdentifier,
): chain is SupportedChainName {
  return typeof chain === "string";
}
