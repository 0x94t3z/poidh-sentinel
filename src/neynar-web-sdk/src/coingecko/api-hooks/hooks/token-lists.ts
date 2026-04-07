/**
 * CoinGecko Token Lists API hooks
 *
 * This module provides React hooks for accessing CoinGecko's token lists API,
 * which returns ERC-20 token information for various blockchain platforms.
 * Token lists are standardized JSON files containing token metadata for DeFi applications.
 *
 * All hooks use TanStack Query for efficient caching, background updates,
 * and automatic error handling with sensible defaults optimized for blockchain data.
 *
 * @see {@link https://www.coingecko.com/api/documentation} CoinGecko API Documentation
 * @see {@link https://tokenlists.org/} Token Lists Standard
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { CoinGeckoHookOptions, TokenList } from "../types";
import type {
  ExtendedQueryOptions,
  QueryHookResult,
} from "../../../private/api-hooks/types";

/**
 * Hook to fetch a complete token list for a specific blockchain platform.
 *
 * This hook retrieves standardized ERC-20 token information including contract addresses,
 * symbols, names, decimals, and logo URIs for the specified asset platform.
 * Token lists are commonly used by DEXs and DeFi protocols for token discovery and verification.
 *
 * **Rate Limits**: This endpoint is included in CoinGecko API rate limits
 * **Caching**: Data is cached for 24 hours as token lists are relatively stable
 * **Error Handling**: Failed requests are automatically retried with exponential backoff
 *
 * @param assetPlatformId - The asset platform identifier (blockchain network)
 *   Common values: 'ethereum', 'polygon-pos', 'binance-smart-chain', 'avalanche',
 *   'arbitrum-one', 'optimistic-ethereum', 'fantom', 'xdai', 'harmony-shard-0'
 * @param options - Configuration options for query behavior and data fetching
 * @param options.enabled - Whether the query should execute automatically (default: true when assetPlatformId exists)
 * @param options.staleTime - How long data stays fresh before refetching (default: 24 hours)
 * @param options.refetchOnWindowFocus - Whether to refetch when window regains focus (default: false for stability)
 * @param options.retry - Number of retry attempts on failure (default: 3)
 * @param options.retryDelay - Delay between retry attempts in milliseconds
 *
 * @returns TanStack Query result containing comprehensive token list data
 * @returns result.data - Token list object with metadata and tokens array
 * @returns result.data.name - Human-readable name of the token list
 * @returns result.data.timestamp - ISO timestamp of when list was last updated
 * @returns result.data.tokens - Array of token objects with contract details
 * @returns result.isLoading - Whether the request is currently in progress
 * @returns result.error - Any error that occurred during fetching
 * @returns result.isSuccess - Whether the request completed successfully
 * @returns result.isFetching - Whether a background refetch is in progress
 *
 * @example
 * ```typescript
 * // Fetch Ethereum token list
 * function EthereumTokens() {
 *   const { data: tokenList, isLoading, error } = useTokenList('ethereum');
 *
 *   if (isLoading) return <div>Loading token list...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>{tokenList?.name}</h2>
 *       <p>Total tokens: {tokenList?.tokens?.length}</p>
 *       {tokenList?.tokens?.slice(0, 5).map(token => (
 *         <div key={token.address}>
 *           <strong>{token.symbol}</strong> - {token.name}
 *           <br />
 *           <code>{token.address}</code>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Fetch Polygon token list with custom cache time
 * function PolygonTokens() {
 *   const { data: tokenList } = useTokenList('polygon-pos', {
 *     staleTime: 12 * 60 * 60 * 1000, // 12 hours
 *     enabled: someCondition, // Conditional fetching
 *   });
 *
 *   // Filter for USDC tokens
 *   const usdcTokens = tokenList?.tokens?.filter(
 *     token => token.symbol.includes('USDC')
 *   );
 *
 *   return (
 *     <div>
 *       <h3>USDC variants on Polygon</h3>
 *       {usdcTokens?.map(token => (
 *         <div key={token.address}>
 *           {token.name} ({token.symbol}) - {token.decimals} decimals
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Use with DeFi token selection
 * function TokenSelector({ onTokenSelect }: { onTokenSelect: (token: TokenListToken) => void }) {
 *   const { data: tokenList } = useTokenList('ethereum');
 *
 *   return (
 *     <select onChange={(e) => {
 *       const token = tokenList?.tokens?.find(t => t.address === e.target.value);
 *       if (token) onTokenSelect(token);
 *     }}>
 *       <option value="">Select a token...</option>
 *       {tokenList?.tokens?.map(token => (
 *         <option key={token.address} value={token.address}>
 *           {token.name} ({token.symbol})
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 *
 * @see {@link TokenList} For the complete data structure returned
 * @see {@link TokenListToken} For individual token object structure
 * @see {@link https://www.coingecko.com/api/documentation#tag/token-lists} API endpoint documentation
 */
export function useTokenList(
  assetPlatformId: string,
  options?: ExtendedQueryOptions<TokenList> & CoinGeckoHookOptions,
): QueryHookResult<TokenList> {
  return useApiQuery<TokenList>(
    coinGeckoQueryKeys.tokenLists.platform(assetPlatformId),
    `/api/coingecko/token-lists/${assetPlatformId}/all.json`,
    {
      enabled: Boolean(assetPlatformId?.trim()),
      staleTime: 24 * 60 * 60 * 1000, // 24 hours - token lists are relatively stable
      refetchOnWindowFocus: false, // Token lists don't need frequent updates
      retry: 3, // Retry failed requests
      ...options,
    },
  );
}
