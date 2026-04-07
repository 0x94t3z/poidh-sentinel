/**
 * CoinGecko Categories API Hooks
 *
 * React Query hooks for CoinGecko category-related operations.
 * Uses TanStack Query v5 with proper error handling, type safety, and hierarchical caching.
 *
 * This module provides comprehensive hooks for coin category data from CoinGecko,
 * including category listings with market data and simple category lists for
 * filtering and organization purposes.
 *
 * @example Basic Usage
 * ```tsx
 * import { useCoinsCategories, useCoinsCategoriesList } from '@/neynar-web-sdk/api-hooks';
 *
 * function CategoryExplorer() {
 *   const { data: categories, isLoading } = useCoinsCategories({ order: 'market_cap_desc' });
 *   const { data: categoryList } = useCoinsCategoriesList();
 *
 *   if (isLoading) return <div>Loading categories...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Categories ({categories?.length})</h2>
 *       {categories?.map(category => (
 *         <div key={category.id}>
 *           <h3>{category.name}</h3>
 *           <p>Market Cap: ${category.market_cap?.toLocaleString()}</p>
 *           <p>24h Change: {category.market_cap_change_24h}%</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type {
  CoinGeckoHookOptions,
  CoinCategory,
  CategoryListItem,
  CoinsCategoriesParams,
} from "../types";
import type { ExtendedQueryOptions } from "../../../private/api-hooks/types";

// ============================================================================
// Category Query Hooks
// ============================================================================

/**
 * Get coins categories with market data
 *
 * Fetches comprehensive category information from CoinGecko including market cap,
 * 24-hour changes, volume data, and top coins for each category. Categories represent
 * different sectors or types of cryptocurrencies (e.g., "DeFi", "NFT", "Gaming").
 *
 * @param params - Query parameters for filtering and ordering results
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing category data with market information
 *
 * @example Basic category listing
 * ```tsx
 * function CategoriesOverview() {
 *   const { data: categories, isLoading, error } = useCoinsCategories();
 *
 *   if (isLoading) return <div>Loading categories...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!categories?.length) return <div>No categories found</div>;
 *
 *   return (
 *     <div>
 *       <h2>Crypto Categories</h2>
 *       {categories.map(category => (
 *         <div key={category.id} className="category-card">
 *           <h3>{category.name}</h3>
 *           <p>Market Cap: ${category.market_cap.toLocaleString()}</p>
 *           <p className={category.market_cap_change_24h >= 0 ? 'positive' : 'negative'}>
 *             24h: {category.market_cap_change_24h.toFixed(2)}%
 *           </p>
 *           <p>Volume: ${category.volume_24h.toLocaleString()}</p>
 *           {category.top_3_coins && (
 *             <p>Top coins: {category.top_3_coins.join(", ")}</p>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Ordered by market cap change
 * ```tsx
 * function TrendingCategories() {
 *   const { data: categories } = useCoinsCategories({
 *     order: 'market_cap_change_24h_desc'
 *   });
 *
 *   return (
 *     <div>
 *       <h2>Trending Categories (24h)</h2>
 *       {categories?.slice(0, 5).map(category => (
 *         <div key={category.id}>
 *           <span>{category.name}</span>
 *           <span className="change-badge">
 *             +{category.market_cap_change_24h.toFixed(2)}%
 *           </span>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Custom caching and error handling
 * ```tsx
 * function CategoriesWithCustomOptions() {
 *   const { data, isLoading, refetch } = useCoinsCategories(
 *     { order: 'market_cap_desc' },
 *     {
 *       staleTime: 30 * 60 * 1000, // 30 minutes
 *       retry: 3,
 *       refetchOnWindowFocus: false,
 *     }
 *   );
 *
 *   return (
 *     <div>
 *       <button onClick={() => refetch()}>Refresh Categories</button>
 *       {isLoading ? 'Loading...' : `${data?.length || 0} categories`}
 *     </div>
 *   );
 * }
 * ```
 */
export function useCoinsCategories(
  params?: CoinsCategoriesParams,
  options?: ExtendedQueryOptions<CoinCategory[]> & CoinGeckoHookOptions,
) {
  const queryParams = new URLSearchParams();
  if (params?.order) queryParams.set("order", params.order);

  return useApiQuery<CoinCategory[]>(
    coinGeckoQueryKeys.coins.categories(params),
    `/api/coingecko/coins/categories?${queryParams}`,
    {
      staleTime: 60 * 60 * 1000, // 1 hour - market data changes frequently
      ...options,
    },
  );
}

/**
 * Get coins categories list (simple)
 *
 * Fetches a simplified list of all available coin categories without market data.
 * This endpoint is optimized for dropdown menus, filters, and other UI components
 * that need category names and IDs but don't require market information. The data
 * is cached for 24 hours as category lists are relatively stable.
 *
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing simple category list data
 *
 * @example Category selector dropdown
 * ```tsx
 * function CategorySelector({ onSelect }: { onSelect: (categoryId: string) => void }) {
 *   const { data: categories, isLoading } = useCoinsCategoriesList();
 *
 *   if (isLoading) return <select disabled><option>Loading...</option></select>;
 *
 *   return (
 *     <select onChange={(e) => onSelect(e.target.value)} defaultValue="">
 *       <option value="">All Categories</option>
 *       {categories?.map(category => (
 *         <option key={category.category_id} value={category.category_id}>
 *           {category.name}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 *
 * @example Category filter chips
 * ```tsx
 * function CategoryFilters({ selectedCategories, onToggle }: {
 *   selectedCategories: string[];
 *   onToggle: (categoryId: string) => void;
 * }) {
 *   const { data: categories } = useCoinsCategoriesList();
 *
 *   return (
 *     <div className="filter-chips">
 *       {categories?.map(category => (
 *         <button
 *           key={category.category_id}
 *           className={`chip ${selectedCategories.includes(category.category_id) ? 'active' : ''}`}
 *           onClick={() => onToggle(category.category_id)}
 *         >
 *           {category.name}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Searchable category list
 * ```tsx
 * function SearchableCategories() {
 *   const { data: categories } = useCoinsCategoriesList();
 *   const [search, setSearch] = useState('');
 *
 *   const filteredCategories = categories?.filter(category =>
 *     category.name.toLowerCase().includes(search.toLowerCase())
 *   );
 *
 *   return (
 *     <div>
 *       <input
 *         type="text"
 *         placeholder="Search categories..."
 *         value={search}
 *         onChange={(e) => setSearch(e.target.value)}
 *       />
 *       <ul>
 *         {filteredCategories?.map(category => (
 *           <li key={category.category_id}>{category.name}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCoinsCategoriesList(
  options?: ExtendedQueryOptions<CategoryListItem[]> & CoinGeckoHookOptions,
) {
  return useApiQuery<CategoryListItem[]>(
    coinGeckoQueryKeys.coins.categoriesList(),
    "/api/coingecko/coins/categories/list",
    {
      staleTime: 24 * 60 * 60 * 1000, // 24 hours - categories list is stable
      ...options,
    },
  );
}
