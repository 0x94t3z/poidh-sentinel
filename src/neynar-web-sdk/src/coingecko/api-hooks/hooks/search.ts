/**
 * CoinGecko Search & Discovery API Hooks
 *
 * Comprehensive hooks for search and discovery including:
 * - General search functionality across coins, exchanges, categories, and NFTs
 * - Trending coins, NFTs, and categories
 * - Search validation and optimization
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { CoinGeckoHookOptions, SearchResponse } from "../types";
import type {
  ExtendedQueryOptions,
  QueryHookResult,
} from "../../../private/api-hooks/types";

// ============================================================================
// Search Validation Types
// ============================================================================

/**
 * Search validation result
 */
type SearchValidation = {
  /** Whether the query is valid for searching */
  isValid: boolean;
  /** Validation error message if invalid */
  error?: string;
  /** Normalized query string ready for API call */
  normalizedQuery?: string;
};

// ============================================================================
// Search Hooks
// ============================================================================

/**
 * Performs comprehensive search across coins, exchanges, categories, and NFTs
 *
 * This hook provides real-time search functionality across all CoinGecko data types
 * with built-in validation, debouncing recommendations, and comprehensive error handling.
 *
 * @param query - Search term to query across all CoinGecko data types (minimum 2 characters)
 * @param options - Additional TanStack Query options for customizing behavior
 * @returns UseQueryResult containing search results with coins, exchanges, categories, and NFTs
 *
 * @example Basic search with validation
 * ```typescript
 * function CryptoSearch() {
 *   const [searchTerm, setSearchTerm] = useState("");
 *   const { data: searchResults, isLoading, error, isError } = useSearch(searchTerm, {
 *     enabled: searchTerm.length >= 2, // Only search when query is long enough
 *     staleTime: 10 * 60 * 1000, // Cache results for 10 minutes
 *   });
 *
 *   if (isLoading) return React.createElement('div', null, 'Searching...');
 *   if (isError) return React.createElement('div', null, `Search failed: ${error?.message}`);
 *
 *   return React.createElement('div', null, [
 *     React.createElement('input', {
 *       key: 'search-input',
 *       value: searchTerm,
 *       onChange: (e) => setSearchTerm(e.target.value),
 *       placeholder: "Search coins, exchanges, NFTs...",
 *       className: "w-full p-3 border rounded-lg"
 *     }),
 *     searchResults?.coins && searchResults.coins.length > 0 &&
 *       React.createElement('section', { key: 'coins' }, [
 *         React.createElement('h3', { key: 'title' }, `Coins (${searchResults.coins.length})`),
 *         ...searchResults.coins.map(coin =>
 *           React.createElement('div', {
 *             key: coin.id,
 *             className: "flex items-center gap-3 p-2"
 *           }, [
 *             coin.thumb && React.createElement('img', {
 *               src: coin.thumb,
 *               alt: coin.name,
 *               className: "w-6 h-6"
 *             }),
 *             React.createElement('span', null, `${coin.name} (${coin.symbol?.toUpperCase()})`),
 *             coin.market_cap_rank && React.createElement('span', null, `Rank #${coin.market_cap_rank}`)
 *           ])
 *         )
 *       ])
 *   ]);
 * }
 * ```
 *
 * @example Search with debouncing and advanced filtering
 * ```typescript
 * import { useMemo } from 'react';
 * import { useDebounce } from '@/hooks/useDebounce';
 *
 * function AdvancedCryptoSearch() {
 *   const [searchTerm, setSearchTerm] = useState("");
 *   const [filterType, setFilterType] = useState<'all' | 'coins' | 'exchanges'>('all');
 *
 *   // Debounce search input to avoid excessive API calls
 *   const debouncedSearchTerm = useDebounce(searchTerm, 300);
 *
 *   const { data: searchResults, isLoading, error } = useSearch(debouncedSearchTerm, {
 *     enabled: debouncedSearchTerm.length >= 2,
 *     staleTime: 5 * 60 * 1000, // Cache for 5 minutes
 *   });
 *
 *   // Filter results based on user selection
 *   const filteredResults = useMemo(() => {
 *     if (!searchResults) return null;
 *
 *     switch (filterType) {
 *       case 'coins':
 *         return { ...searchResults, exchanges: [], categories: [], nfts: [] };
 *       case 'exchanges':
 *         return { ...searchResults, coins: [], categories: [], nfts: [] };
 *       default:
 *         return searchResults;
 *     }
 *   }, [searchResults, filterType]);
 *
 *   const totalResults = filteredResults ?
 *     filteredResults.coins.length + filteredResults.exchanges.length +
 *     filteredResults.categories.length + filteredResults.nfts.length : 0;
 *
 *   return {
 *     searchInput: React.createElement('input', {
 *       value: searchTerm,
 *       onChange: (e) => setSearchTerm(e.target.value),
 *       placeholder: "Search crypto data...",
 *       className: "flex-1 p-3 border rounded-lg"
 *     }),
 *     filterSelect: React.createElement('select', {
 *       value: filterType,
 *       onChange: (e) => setFilterType(e.target.value as any),
 *       className: "p-3 border rounded-lg"
 *     }),
 *     isLoading,
 *     error,
 *     totalResults,
 *     filteredResults
 *   };
 * }
 * ```
 */
export function useSearch(
  query: string,
  options?: ExtendedQueryOptions<SearchResponse> & CoinGeckoHookOptions,
): QueryHookResult<SearchResponse> {
  // Validate and normalize query
  const validation = validateSearchQuery(query);

  const queryParams = new URLSearchParams();
  if (validation.normalizedQuery) {
    queryParams.set("query", validation.normalizedQuery);
  }

  return useApiQuery<SearchResponse>(
    coinGeckoQueryKeys.search.query(validation.normalizedQuery || ""),
    `/api/coingecko/search?${queryParams}`,
    {
      enabled: validation.isValid,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: (failureCount, error) => {
        // Don't retry validation errors
        if (error.message.includes("validation")) return false;
        return failureCount < 2;
      },
      ...options,
    },
  );
}

/**
 * Fetches trending search results including trending coins, NFTs, and categories
 *
 * This hook provides access to CoinGecko's trending data which updates frequently
 * and shows the most popular items being searched and viewed on the platform.
 *
 * @param options - Additional TanStack Query options for customizing caching and behavior
 * @returns UseQueryResult containing trending coins, NFTs, and categories with market data
 *
 * @example Basic trending widget
 * ```typescript
 * function TrendingWidget() {
 *   const { data: trending, isLoading, error } = useTrendingSearch({
 *     refetchInterval: 15 * 60 * 1000, // Refresh every 15 minutes
 *   });
 *
 *   if (isLoading) return React.createElement('div', null, 'Loading trending data...');
 *   if (error) return React.createElement('div', null, `Failed to load trending: ${error.message}`);
 *
 *   return React.createElement('div', { className: "space-y-6" }, [
 *     React.createElement('section', { key: 'coins' }, [
 *       React.createElement('h2', {
 *         key: 'title',
 *         className: "text-xl font-bold mb-3"
 *       }, '🔥 Trending Coins'),
 *       React.createElement('div', {
 *         key: 'content',
 *         className: "space-y-2"
 *       }, trending?.coins?.map((coin, index) =>
 *         React.createElement('div', {
 *           key: coin.id,
 *           className: "flex items-center gap-3 p-3 bg-white rounded-lg shadow"
 *         }, [
 *           React.createElement('span', {
 *             key: 'rank',
 *             className: "font-bold text-gray-500"
 *           }, `#${index + 1}`),
 *           coin.thumb && React.createElement('img', {
 *             key: 'thumb',
 *             src: coin.thumb,
 *             alt: coin.name,
 *             className: "w-8 h-8"
 *           }),
 *           React.createElement('div', { key: 'info' }, [
 *             React.createElement('div', {
 *               key: 'name',
 *               className: "font-medium"
 *             }, `${coin.name} (${coin.symbol?.toUpperCase()})`),
 *             coin.market_cap_rank && React.createElement('div', {
 *               key: 'rank-info',
 *               className: "text-sm text-gray-600"
 *             }, `Market Cap Rank #${coin.market_cap_rank}`)
 *           ])
 *         ])
 *       ))
 *     ])
 *   ]);
 * }
 * ```
 *
 * @example Trending data with performance metrics
 * ```typescript
 * function TrendingAnalytics() {
 *   const { data: trending, isLoading, error, dataUpdatedAt } = useTrendingSearch({
 *     refetchInterval: 10 * 60 * 1000, // Update every 10 minutes
 *     staleTime: 5 * 60 * 1000, // Consider stale after 5 minutes
 *   });
 *
 *   if (isLoading) return React.createElement('div', null, 'Loading trending analytics...');
 *   if (error) return React.createElement('div', null, `Error loading data: ${error.message}`);
 *
 *   const lastUpdated = new Date(dataUpdatedAt).toLocaleTimeString();
 *
 *   return {
 *     lastUpdated,
 *     coinsCount: trending?.coins?.length || 0,
 *     nftsCount: trending?.nfts?.length || 0,
 *     categoriesCount: trending?.categories?.length || 0,
 *     trending
 *   };
 * }
 * ```
 */
export function useTrendingSearch(
  options?: ExtendedQueryOptions<SearchResponse> & CoinGeckoHookOptions,
): QueryHookResult<SearchResponse> {
  return useApiQuery<SearchResponse>(
    coinGeckoQueryKeys.search.trending(),
    `/api/coingecko/search/trending`,
    {
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 60 * 60 * 1000, // 1 hour
      refetchInterval: 15 * 60 * 1000, // Auto-refresh every 15 minutes
      ...options,
    },
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates and normalizes a search query
 *
 * @param query - Raw search query string
 * @returns Validation result with normalized query
 *
 * @internal
 */
function validateSearchQuery(query: string): SearchValidation {
  // Handle null, undefined, or non-string input
  if (!query || typeof query !== "string") {
    return {
      isValid: false,
      error: "Search query must be a non-empty string",
    };
  }

  // Normalize whitespace and trim
  const normalized = query.trim().replace(/\s+/g, " ");

  // Check minimum length requirement
  if (normalized.length < 2) {
    return {
      isValid: false,
      error: "Search query must be at least 2 characters long",
    };
  }

  // Check maximum reasonable length (CoinGecko typically limits this)
  if (normalized.length > 100) {
    return {
      isValid: false,
      error: "Search query is too long (maximum 100 characters)",
    };
  }

  // Valid query
  return {
    isValid: true,
    normalizedQuery: normalized,
  };
}

/**
 * Utility function to check if a search query is valid without performing validation
 *
 * @param query - Search query to validate
 * @returns Whether the query meets minimum requirements for search
 *
 * @example Basic form validation
 * ```typescript
 * function SearchInput({ onSearch }: { onSearch: (query: string) => void }) {
 *   const [query, setQuery] = useState('');
 *
 *   const handleSubmit = (e: React.FormEvent) => {
 *     e.preventDefault();
 *     if (isValidSearchQuery(query)) {
 *       onSearch(query);
 *     } else {
 *       alert('Please enter at least 2 characters to search');
 *     }
 *   };
 *
 *   return React.createElement('form', { onSubmit: handleSubmit }, [
 *     React.createElement('input', {
 *       key: 'input',
 *       value: query,
 *       onChange: (e) => setQuery(e.target.value),
 *       placeholder: "Search..."
 *     }),
 *     React.createElement('button', {
 *       key: 'button',
 *       type: "submit",
 *       disabled: !isValidSearchQuery(query)
 *     }, 'Search')
 *   ]);
 * }
 * ```
 */
export function isValidSearchQuery(query: string): boolean {
  return validateSearchQuery(query).isValid;
}
