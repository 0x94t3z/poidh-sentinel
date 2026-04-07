import { createRouter } from "../../shared/api-handlers";
import { buildCoinGeckoRoutes } from "./routes";
import type { MethodHandlers } from "../../shared/api-handlers";
import type { Coingecko } from "@coingecko/coingecko-typescript";

/**
 * Creates CoinGecko-specific API handlers with an instantiated CoinGecko SDK client
 *
 * This is a CoinGecko-specific wrapper around the generic createRouter that:
 * - Maps to all CoinGecko SDK methods via dependency injection
 * - Provides type safety for Coingecko client
 * - Handles CoinGecko-specific error responses
 * - Includes sensible CoinGecko-specific CORS defaults
 *
 * @param client - Instantiated Coingecko client with API key (dependency injection for testability)
 * @returns Object with HTTP method handlers (GET, POST, PUT, DELETE, etc.)
 *
 * @example Complete API route setup (app/api/coingecko/[...route]/route.ts)
 * ```typescript
 * import { Coingecko } from "@coingecko/coingecko-typescript";
 * import { createCoinGeckoApiHandler } from "@/neynar-web-sdk/nextjs";
 * import { privateConfig } from "@/config/private-config";
 *
 * const client = new Coingecko({
 *   demoAPIKey: privateConfig.coingeckoApiKey,
 *   environment: "demo",
 * });
 *
 * export const { GET, POST, PUT, DELETE, OPTIONS } = createCoinGeckoApiHandler(client);
 * ```
 *
 * @remarks
 * Routes are organized by API category:
 * - `/asset-platforms` - Asset platform information
 * - `/coins/*` - Comprehensive coin data (prices, metadata, history, charts)
 * - `/companies/*` - Public companies' crypto treasury data
 * - `/derivatives/*` - Derivatives exchanges and data
 * - `/exchange-rates` - Exchange rates information
 * - `/exchanges/*` - Exchange data, tickers, and volume charts
 * - `/global/*` - Global market data and charts
 * - `/key` - API key validation
 * - `/nfts/*` - NFT collections and market data
 * - `/onchain/*` - DeFi pools, tokens, and on-chain analytics
 * - `/ping` - Health check endpoint
 * - `/search` - Search coins, exchanges, and categories
 * - `/simple/*` - Simple price and currency endpoints
 * - `/token-lists/*` - Token lists for various blockchains
 */
export function createCoinGeckoApiHandler(client: Coingecko): MethodHandlers {
  const routes = buildCoinGeckoRoutes(client);

  return createRouter({
    routes,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-API-Key, x-cg-pro-api-key, x-cg-demo-api-key",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

// No type exports needed - consumers import Coingecko directly from @coingecko/coingecko-typescript
// and don't need to know about internal API handler types
