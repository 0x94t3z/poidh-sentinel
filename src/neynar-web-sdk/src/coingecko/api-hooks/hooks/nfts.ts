/**
 * CoinGecko NFTs API Hooks
 *
 * Comprehensive hooks for NFT data including:
 * - Individual NFT collection details and analytics
 * - NFT collections list with filtering and pagination
 * - NFT markets data with trading metrics
 * - Floor price tracking and volume statistics
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type {
  NFTCollection,
  NFTListItem,
  NFTMarket,
  NFTListParams,
  NFTMarketsParams,
  CoinGeckoHookOptions,
} from "../types";
import type {
  ExtendedQueryOptions,
  QueryHookResult,
} from "../../../private/api-hooks/types";

// ============================================================================
// NFT Collection Detail Hook
// ============================================================================

/**
 * Fetches comprehensive data for a specific NFT collection
 *
 * This hook provides detailed information about an individual NFT collection including
 * floor prices, trading volumes, market caps, collection statistics, and metadata.
 * Perfect for NFT collection pages, portfolio tracking, and market analysis.
 *
 * @param id - The NFT collection's unique identifier (e.g., 'cryptopunks', 'bored-ape-yacht-club')
 * @param options - Configuration options for query behavior and data fetching
 * @param options.enabled - Whether the query should execute automatically (default: true when id exists)
 * @param options.staleTime - How long data stays fresh before refetching (default: 5 minutes)
 * @param options.refetchOnWindowFocus - Whether to refetch when window regains focus
 *
 * @returns TanStack Query result with comprehensive NFT collection data
 *
 * @example
 * ```typescript
 * const { data: collection, isLoading, error } = useNFT(
 *   'cryptopunks',
 *   {
 *     staleTime: 300000, // 5 minutes
 *     refetchOnWindowFocus: false,
 *   }
 * );
 *
 * // Access NFT collection information:
 * console.log(`${collection?.name} Collection`);
 * console.log(`Floor Price: ${collection?.floor_price?.usd} USD`);
 * console.log(`Total Supply: ${collection?.total_supply} items`);
 * console.log(`24h Volume: ${collection?.volume_24h?.usd} USD`);
 * console.log(`Market Cap: ${collection?.market_cap?.usd} USD`);
 *
 * // Track price changes:
 * const floorPriceChange = collection?.floor_price_24h_percentage_change;
 * const isIncreasing = floorPriceChange && floorPriceChange > 0;
 * ```
 */
export function useNFT(
  id: string,
  options?: ExtendedQueryOptions<NFTCollection> & CoinGeckoHookOptions,
): QueryHookResult<NFTCollection> {
  return useApiQuery<NFTCollection>(
    coinGeckoQueryKeys.nfts.detail(id),
    `/api/coingecko/nfts/${id}`,
    {
      enabled: Boolean(id?.trim()),
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      ...options,
    },
  );
}

// ============================================================================
// NFT Collections List Hook
// ============================================================================

/**
 * Fetches a paginated list of NFT collections with filtering and sorting options
 *
 * This hook provides a comprehensive list of NFT collections with basic metadata,
 * ideal for building NFT marketplace interfaces, collection browsers, and search
 * functionality. Supports filtering by blockchain network and custom sorting.
 *
 * @param params - Optional filtering and pagination parameters
 * @param params.order - Sort order for results (e.g., 'h24_volume_usd_desc', 'market_cap_usd_desc')
 * @param params.asset_platform_id - Filter by blockchain platform (e.g., 'ethereum', 'polygon-pos')
 * @param params.per_page - Number of collections per page (1-250, default: 100)
 * @param params.page - Page number for pagination (default: 1)
 * @param options - Configuration options for query behavior and data fetching
 * @param options.staleTime - How long data stays fresh before refetching (default: 1 hour)
 * @param options.enabled - Whether the query should execute automatically (default: true)
 *
 * @returns TanStack Query result with array of NFT collection summaries
 *
 * @example
 * ```typescript
 * const { data: nftsList, isLoading, error } = useNFTsList(
 *   {
 *     order: 'h24_volume_usd_desc', // Sort by 24h volume descending
 *     asset_platform_id: 'ethereum', // Only Ethereum NFTs
 *     per_page: 50,
 *     page: 1,
 *   },
 *   {
 *     staleTime: 3600000, // 1 hour cache
 *     refetchOnWindowFocus: false,
 *   }
 * );
 *
 * // Build NFT collection grid:
 * nftsList?.forEach((collection, index) => {
 *   console.log(`#${index + 1}: ${collection.name}`);
 *   console.log(`Symbol: ${collection.symbol || 'N/A'}`);
 *   console.log(`Thumbnail: ${collection.thumb}`);
 * });
 *
 * // Filter collections by name:
 * const searchTerm = 'ape';
 * const filteredCollections = nftsList?.filter(collection =>
 *   collection.name.toLowerCase().includes(searchTerm.toLowerCase())
 * );
 * ```
 */
export function useNFTsList(
  params?: NFTListParams,
  options?: ExtendedQueryOptions<NFTListItem[]> & CoinGeckoHookOptions,
): QueryHookResult<NFTListItem[]> {
  const queryParams = new URLSearchParams();
  if (params?.order) queryParams.set("order", params.order);
  if (params?.asset_platform_id)
    queryParams.set("asset_platform_id", params.asset_platform_id);
  if (params?.per_page) queryParams.set("per_page", params.per_page.toString());
  if (params?.page) queryParams.set("page", params.page.toString());

  return useApiQuery<NFTListItem[]>(
    coinGeckoQueryKeys.nfts.list(params),
    `/api/coingecko/nfts/list?${queryParams}`,
    {
      staleTime: 60 * 60 * 1000, // 1 hour
      gcTime: 4 * 60 * 60 * 1000, // 4 hours
      ...options,
    },
  );
}

// ============================================================================
// NFT Markets Data Hook
// ============================================================================

/**
 * Fetches comprehensive NFT market data with trading metrics and performance indicators
 *
 * This hook provides detailed market information for NFT collections including
 * floor prices, trading volumes, market caps, and percentage changes. Essential
 * for building NFT trading interfaces, market analysis tools, and portfolio dashboards.
 *
 * @param params - Optional filtering and pagination parameters for market data
 * @param params.asset_platform_id - Filter by blockchain platform (e.g., 'ethereum', 'polygon-pos', 'avalanche')
 * @param params.order - Sort order for market results (e.g., 'market_cap_usd_desc', 'floor_price_usd_desc')
 * @param params.per_page - Number of markets per page (1-250, default: 100)
 * @param params.page - Page number for pagination (default: 1)
 * @param options - Configuration options for query behavior and real-time updates
 * @param options.staleTime - How long data stays fresh before refetching (default: 2 minutes)
 * @param options.refetchInterval - Automatic refetch interval for live market data
 * @param options.enabled - Whether the query should execute automatically (default: true)
 *
 * @returns TanStack Query result with array of NFT market data including trading metrics
 *
 * @example
 * ```typescript
 * const { data: markets, isLoading, error } = useNFTsMarkets(
 *   {
 *     asset_platform_id: 'ethereum',
 *     order: 'h24_volume_usd_desc', // Sort by 24h volume
 *     per_page: 25,
 *     page: 1,
 *   },
 *   {
 *     staleTime: 120000, // 2 minutes
 *     refetchInterval: 300000, // Auto-refresh every 5 minutes
 *     refetchOnWindowFocus: true, // Refresh on window focus
 *   }
 * );
 *
 * // Display top performing NFT markets:
 * markets?.forEach((market, index) => {
 *   console.log(`#${index + 1}: ${market.name}`);
 *   console.log(`Floor Price: $${market.floor_price_in_usd}`);
 *   console.log(`24h Volume: $${market.h24_volume_in_usd}`);
 *   console.log(`Market Cap: $${market.market_cap_in_usd}`);
 *   console.log(`24h Change: ${market.floor_price_in_usd_24h_percentage_change}%`);
 * });
 *
 * // Find trending collections (positive price movement):
 * const trendingCollections = markets?.filter(market =>
 *   market.floor_price_in_usd_24h_percentage_change > 10
 * ).slice(0, 5);
 *
 * // Calculate average metrics:
 * const avgFloorPrice = markets?.reduce((sum, market) =>
 *   sum + (market.floor_price_in_usd || 0), 0
 * ) / (markets?.length || 1);
 * ```
 */
export function useNFTsMarkets(
  params?: NFTMarketsParams,
  options?: ExtendedQueryOptions<NFTMarket[]> & CoinGeckoHookOptions,
): QueryHookResult<NFTMarket[]> {
  const queryParams = new URLSearchParams();
  if (params?.asset_platform_id)
    queryParams.set("asset_platform_id", params.asset_platform_id);
  if (params?.order) queryParams.set("order", params.order);
  if (params?.per_page) queryParams.set("per_page", params.per_page.toString());
  if (params?.page) queryParams.set("page", params.page.toString());

  return useApiQuery<NFTMarket[]>(
    coinGeckoQueryKeys.nfts.markets(params),
    `/api/coingecko/nfts/markets?${queryParams}`,
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      gcTime: 15 * 60 * 1000, // 15 minutes
      ...options,
    },
  );
}
