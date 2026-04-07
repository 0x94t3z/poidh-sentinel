export type FarcasterCategory =
  | "games"
  | "social"
  | "finance"
  | "utility"
  | "productivity"
  | "health-fitness"
  | "news-media"
  | "music"
  | "shopping"
  | "education"
  | "developer-tools"
  | "entertainment"
  | "art-creativity";

/** CAIP-2 chain identifiers - see https://chainagnostic.org/CAIPs/caip-2 */
type RequiredChain =
  | "eip155:1" // Ethereum mainnet
  | "eip155:8453" // Base mainnet
  | "eip155:42161" // Arbitrum One
  | "eip155:421614" // Arbitrum Sepolia
  | "eip155:84532" // Base Sepolia
  | "eip155:666666666" // Degen
  | "eip155:100" // Gnosis
  | "eip155:10" // Optimism
  | "eip155:11155420" // Optimism Sepolia
  | "eip155:137" // Polygon
  | "eip155:11155111" // Sepolia
  | "eip155:7777777" // Zora
  | "eip155:130" // Unichain
  | "eip155:10143" // Monad testnet
  | "eip155:42220" // Celo
  | "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"; // Solana mainnet

export type AppSettings = {
  name: string;
  shareButtonTitle: string;
  subtitle: string;
  description: string;
  shortDescription: string;
  primaryCategory: FarcasterCategory;
  tags: string[];
  splashBackgroundColor: string;
  tagline: string;
  shortName: string;
  requiredChains: Array<RequiredChain>;
};
