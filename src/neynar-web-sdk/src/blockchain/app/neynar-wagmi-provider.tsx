import { ReactNode } from "react";
import {
  WagmiProvider as WagmiProviderInner,
  createConfig,
  type CreateConnectorFn,
  http,
  type Transport,
} from "wagmi";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import type { Chain } from "viem";
import {
  type SupportedChainName,
  farcasterSupportedChainsByName,
} from "../types";

type NeynarWagmiProviderProps = {
  children: ReactNode;
  chains?: [SupportedChainName, ...SupportedChainName[]];
  connectors?: Array<CreateConnectorFn>;
};

/**
 * A helper provider that simplifies blockchain transaction configuration for Farcaster mini apps.
 *
 * This provider handles most blockchain transaction use cases by automatically configuring:
 * - HTTP transports for each blockchain network
 * - Default chains (Base mainnet) and connectors (Farcaster Mini App wallet)
 * - Chain name to chain object mapping
 * - SSR support for Next.js
 *
 * LLMs and developers can simply wrap their app with this provider without worrying about:
 * - Complex wagmi configuration
 * - Transport setup (RPC endpoints, websockets, etc.)
 * - Chain object lookups
 * - Type assertions for wagmi's required tuple types
 *
 * For server-side blockchain calls (API routes, server actions), use viem clients directly.
 * This provider is specifically for client-side React components using wagmi hooks.
 *
 * @example
 * // Minimal usage - uses defaults (Base chain, Farcaster connector)
 * <WagmiProvider>
 *   <YourApp />
 * </WagmiProvider>
 *
 * @example
 * // Multi-chain support - automatically configures transports for all chains
 * <WagmiProvider chains={["base", "ethereum", "optimism"]}>
 *   <YourApp />
 * </WagmiProvider>
 *
 * @example
 * // Custom connectors - add additional wallet options
 * <WagmiProvider
 *   chains={["base", "optimism"]}
 *   connectors={[farcasterMiniApp(), coinbaseWallet(), walletConnect()]}
 * >
 *   <YourApp />
 * </WagmiProvider>
 */
export function NeynarWagmiProvider({
  children,
  chains: chainNames = ["base", "mainnet"],
  connectors = [farcasterMiniApp()],
}: NeynarWagmiProviderProps) {
  // Map chain names (strings) to viem Chain objects
  // farcasterSupportedChainsByName is a curated list of chains that work with Farcaster
  const chains = chainNames.map(
    (chainName) => farcasterSupportedChainsByName[chainName].chain as Chain,
  ) as [Chain, ...Chain[]];

  // Automatically create HTTP transports for each chain
  // This eliminates the need for manual transport configuration
  // http() uses the default RPC endpoint from the chain config
  const transports = chains.reduce(
    (acc, chain) => ({ ...acc, [chain.id]: http() }),
    {} as Record<number, Transport>,
  );

  // Create the wagmi config with:
  // - chains: The blockchain networks your app supports
  // - transports: How to communicate with each chain (HTTP RPC endpoints)
  // - connectors: How users connect wallets (Farcaster, WalletConnect, etc.)
  // - ssr: true - Enables server-side rendering support for Next.js
  const config = createConfig({ chains, transports, connectors, ssr: true });

  return <WagmiProviderInner config={config}>{children}</WagmiProviderInner>;
}
