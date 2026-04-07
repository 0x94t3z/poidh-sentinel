/**
 * CoinGecko Asset Platforms API Hooks
 *
 * Comprehensive hooks for blockchain asset platform data including:
 * - List of all supported blockchain networks
 * - Asset platform metadata and chain identifiers
 * - Platform filtering and search capabilities
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { AssetPlatform } from "../types";
import type {
  ExtendedQueryOptions,
  QueryHookResult,
} from "../../../private/api-hooks/types";

// ============================================================================
// Asset Platform Types
// ============================================================================

/**
 * Parameters for asset platform queries
 */
type AssetPlatformsParams = {
  /** Filter platforms by name or identifier */
  filter?: string;
};

/**
 * Hook options specific to CoinGecko asset platform queries
 */
type AssetPlatformsHookOptions = {
  /** Enable/disable the query */
  enabled?: boolean;
  /** Cache time in milliseconds */
  staleTime?: number;
  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;
};

// ============================================================================
// Asset Platform Hooks
// ============================================================================

/**
 * Fetches comprehensive list of all supported blockchain asset platforms
 *
 * This hook provides information about blockchain networks and platforms supported
 * by CoinGecko, including chain identifiers, native coins, and platform metadata.
 * Essential for building multi-chain applications and understanding supported networks.
 *
 * The asset platform data includes Ethereum, Binance Smart Chain, Polygon, Avalanche,
 * and many other blockchain networks with their respective chain IDs and native tokens.
 *
 * @param params - Optional filtering parameters
 * @param params.filter - Filter platforms by name or identifier (case-insensitive)
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result with array of supported blockchain platforms
 *
 * @example
 * ```typescript
 * // Get all supported blockchain platforms
 * const { data: platforms, isLoading, error } = useAssetPlatforms(
 *   undefined,
 *   {
 *     staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours (stable data)
 *     refetchOnWindowFocus: false,
 *   }
 * );
 *
 * // Display supported networks:
 * platforms?.forEach((platform) => {
 *   console.log(`${platform.name} (${platform.id})`);
 *   if (platform.chain_identifier) {
 *     console.log(`Chain ID: ${platform.chain_identifier}`);
 *   }
 *   if (platform.native_coin_id) {
 *     console.log(`Native Token: ${platform.native_coin_id}`);
 *   }
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Filter platforms by name
 * const { data: ethereumPlatforms } = useAssetPlatforms(
 *   { filter: 'ethereum' },
 *   {
 *     staleTime: 24 * 60 * 60 * 1000,
 *     enabled: true,
 *   }
 * );
 *
 * // Use for wallet integration:
 * const supportedChains = ethereumPlatforms
 *   ?.filter(platform => platform.chain_identifier)
 *   ?.map(platform => ({
 *     chainId: platform.chain_identifier!,
 *     name: platform.name,
 *     nativeCurrency: platform.native_coin_id,
 *     rpcUrls: [], // Add your RPC URLs
 *   }));
 * ```
 *
 * @example
 * ```typescript
 * // Check if specific blockchain is supported
 * const { data: platforms } = useAssetPlatforms();
 *
 * const isPolygonSupported = platforms?.some(
 *   platform => platform.id === 'polygon-pos'
 * );
 *
 * const polygonChainId = platforms?.find(
 *   platform => platform.id === 'polygon-pos'
 * )?.chain_identifier; // Should be 137
 * ```
 */
export function useAssetPlatforms(
  params?: AssetPlatformsParams,
  options?: ExtendedQueryOptions<AssetPlatform[]> & AssetPlatformsHookOptions,
): QueryHookResult<AssetPlatform[]> {
  // Build query parameters for API request
  const queryParams = new URLSearchParams();
  if (params?.filter) {
    queryParams.set("filter", params.filter);
  }

  // Construct full URL with query parameters
  const endpoint = queryParams.toString()
    ? `/api/coingecko/asset-platforms?${queryParams}`
    : "/api/coingecko/asset-platforms";

  return useApiQuery<AssetPlatform[]>(
    coinGeckoQueryKeys.assetPlatforms.list(params),
    endpoint,
    {
      // Asset platform data is very stable, cache for 24 hours
      staleTime: 24 * 60 * 60 * 1000, // 24 hours
      gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
      refetchOnWindowFocus: false,
      // Enable by default since this is reference data
      enabled: true,
      ...options,
    },
  );
}
