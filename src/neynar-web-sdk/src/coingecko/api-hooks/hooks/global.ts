/**
 * CoinGecko Global API Hooks
 *
 * React Query hooks for CoinGecko global cryptocurrency market data endpoints.
 * Uses TanStack Query v5 with proper error handling, type safety, and hierarchical caching.
 *
 * This module provides hooks for accessing global cryptocurrency market statistics,
 * including total market capitalization, trading volumes, market dominance data,
 * and historical market cap charts. All data is cached efficiently using the
 * hierarchical query key system.
 *
 * @example Basic Usage
 * ```tsx
 * import { useGlobal, useGlobalMarketCapChart } from '@/neynar-web-sdk/api-hooks';
 *
 * function GlobalMarketStats() {
 *   const { data: globalData, isLoading } = useGlobal();
 *   const { data: chartData } = useGlobalMarketCapChart({ days: '30' });
 *
 *   if (isLoading) return <div>Loading global data...</div>;
 *
 *   return (
 *     <div>
 *       <h1>Global Crypto Market</h1>
 *       <p>Total Market Cap: ${globalData?.data?.total_market_cap?.usd?.toLocaleString()}</p>
 *       <p>Active Cryptocurrencies: {globalData?.data?.active_cryptocurrencies}</p>
 *       <p>Markets: {globalData?.data?.markets}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { CoinGeckoHookOptions } from "../types";
import type {
  ExtendedQueryOptions,
  ApiError,
} from "../../../private/api-hooks/types";
import type { UseQueryResult } from "@tanstack/react-query";

// ============================================================================
// Global API Types
// ============================================================================

/**
 * Global cryptocurrency market data structure
 * Contains comprehensive market statistics including market cap, volumes, and metrics
 */
export type GlobalData = {
  data?: {
    /** Total number of active cryptocurrencies tracked */
    active_cryptocurrencies?: number;
    /** Number of upcoming ICOs */
    upcoming_icos?: number;
    /** Number of ongoing ICOs */
    ongoing_icos?: number;
    /** Number of ended ICOs */
    ended_icos?: number;
    /** Total number of markets tracked */
    markets?: number;
    /** Total market capitalization by currency */
    total_market_cap?: Record<string, number>;
    /** Total 24h trading volume by currency */
    total_volume?: Record<string, number>;
    /** Market cap percentage by cryptocurrency */
    market_cap_percentage?: Record<string, number>;
    /** 24h market cap change percentage in USD */
    market_cap_change_percentage_24h_usd?: number;
    /** Unix timestamp of last update */
    updated_at?: number;
  };
};

/**
 * Historical market cap chart data structure
 * Contains time series data for global market cap and volume
 */
export type MarketCapChartData = {
  market_cap_chart?: {
    /** Array of [timestamp, market_cap] tuples */
    market_cap?: Array<[number, number]>;
    /** Array of [timestamp, volume] tuples */
    volume?: Array<[number, number]>;
  };
};

/**
 * Valid time periods for market cap chart data
 */
export type DaysParam = "1" | "7" | "14" | "30" | "90" | "180" | "365" | "max";

/**
 * Parameters for global market cap chart queries
 */
export type GlobalMarketCapChartParams = {
  /** Number of days of data to fetch */
  days?: DaysParam;
  /** Base currency for chart data (default: 'usd') */
  vs_currency?: string;
};

// ============================================================================
// Global Query Hooks
// ============================================================================

/**
 * Get global cryptocurrency market data
 *
 * Fetches comprehensive global cryptocurrency market statistics from CoinGecko.
 * This includes total market capitalization, trading volumes, number of active
 * cryptocurrencies, ICO statistics, and market dominance percentages across
 * different currencies. Data is cached for 5 minutes for optimal performance.
 *
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing global market data, loading state, and error info
 *
 * @example Basic global market data
 * ```tsx
 * function GlobalMarketOverview() {
 *   const { data: global, isLoading, error } = useGlobal();
 *
 *   if (isLoading) return <div>Loading global market data...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!global?.data) return <div>No global data available</div>;
 *
 *   const { data } = global;
 *   const totalMarketCapUSD = data.total_market_cap?.usd;
 *   const btcDominance = data.market_cap_percentage?.btc;
 *
 *   return (
 *     <div>
 *       <h2>Global Cryptocurrency Market</h2>
 *       <div>Total Market Cap: ${totalMarketCapUSD?.toLocaleString()}</div>
 *       <div>Bitcoin Dominance: {btcDominance?.toFixed(2)}%</div>
 *       <div>Active Cryptocurrencies: {data.active_cryptocurrencies}</div>
 *       <div>Total Markets: {data.markets}</div>
 *       <div>24h Volume: ${data.total_volume?.usd?.toLocaleString()}</div>
 *       <div>24h Change: {data.market_cap_change_percentage_24h_usd?.toFixed(2)}%</div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With custom query options
 * ```tsx
 * function CachedGlobalData() {
 *   const { data } = useGlobal({
 *     staleTime: 10 * 60 * 1000, // Cache for 10 minutes
 *     refetchOnWindowFocus: false,
 *     enabled: true, // Always fetch when component mounts
 *   });
 *
 *   return <div>Market Cap: ${data?.data?.total_market_cap?.usd}</div>;
 * }
 * ```
 *
 * @see {@link useGlobalMarketCapChart} for historical market cap data
 * @see {@link useGlobalDefi} for DeFi-focused global data with different caching strategy
 */
export function useGlobal(
  options?: ExtendedQueryOptions<GlobalData> & CoinGeckoHookOptions,
): UseQueryResult<GlobalData, ApiError> {
  return useApiQuery<GlobalData>(
    coinGeckoQueryKeys.global.data(),
    "/api/coingecko/global",
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...options,
    },
  );
}

/**
 * Get global market capitalization historical chart data
 *
 * Fetches time series data for global cryptocurrency market capitalization and trading volume.
 * Returns arrays of timestamp-value pairs that can be used to create charts showing
 * market trends over time. Data is available for various time periods and can be
 * denominated in different base currencies.
 *
 * @param params - Chart parameters including time period and base currency
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing chart data, loading state, and error info
 *
 * @example Basic market cap chart data
 * ```tsx
 * function GlobalMarketCapChart() {
 *   const { data: chartData, isLoading } = useGlobalMarketCapChart({
 *     days: '30',
 *     vs_currency: 'usd'
 *   });
 *
 *   if (isLoading) return <div>Loading chart data...</div>;
 *
 *   const marketCap = chartData?.market_cap_chart?.market_cap;
 *   const volume = chartData?.market_cap_chart?.volume;
 *
 *   return (
 *     <div>
 *       <h3>30-Day Market Cap Trend</h3>
 *       <div>Data points: {marketCap?.length}</div>
 *       <div>Latest market cap: ${marketCap?.[marketCap.length - 1]?.[1]?.toLocaleString()}</div>
 *       <div>Latest volume: ${volume?.[volume.length - 1]?.[1]?.toLocaleString()}</div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Chart with different time periods
 * ```tsx
 * function MarketCapChartSelector() {
 *   const [timeframe, setTimeframe] = useState<DaysParam>('7');
 *   const { data } = useGlobalMarketCapChart({ days: timeframe });
 *
 *   return (
 *     <div>
 *       <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as DaysParam)}>
 *         <option value="1">1 Day</option>
 *         <option value="7">7 Days</option>
 *         <option value="30">30 Days</option>
 *         <option value="90">90 Days</option>
 *         <option value="365">1 Year</option>
 *         <option value="max">All Time</option>
 *       </select>
 *       {data?.market_cap_chart && <ChartComponent data={data.market_cap_chart} />}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Processing chart data for visualization
 * ```tsx
 * function useProcessedChartData(days: DaysParam = '7') {
 *   const { data, ...queryResult } = useGlobalMarketCapChart({ days });
 *
 *   const processedData = useMemo(() => {
 *     if (!data?.market_cap_chart) return null;
 *
 *     return {
 *       labels: data.market_cap_chart.market_cap?.map(([timestamp]) =>
 *         new Date(timestamp).toLocaleDateString()
 *       ),
 *       marketCap: data.market_cap_chart.market_cap?.map(([, value]) => value),
 *       volume: data.market_cap_chart.volume?.map(([, value]) => value),
 *     };
 *   }, [data]);
 *
 *   return { processedData, ...queryResult };
 * }
 * ```
 *
 * @see {@link useGlobal} for current global market data
 * @see {@link useGlobalDefi} for DeFi-specific global metrics
 */
export function useGlobalMarketCapChart(
  params?: GlobalMarketCapChartParams,
  options?: ExtendedQueryOptions<MarketCapChartData> & CoinGeckoHookOptions,
): UseQueryResult<MarketCapChartData, ApiError> {
  const queryParams = new URLSearchParams();
  if (params?.days) queryParams.set("days", params.days);
  if (params?.vs_currency) queryParams.set("vs_currency", params.vs_currency);

  const days = params?.days || "1";
  const vsCurrency = params?.vs_currency || "usd";

  return useApiQuery<MarketCapChartData>(
    coinGeckoQueryKeys.global.marketCapChart(days, vsCurrency),
    `/api/coingecko/global/market-cap-chart?${queryParams}`,
    {
      staleTime: 60 * 1000, // 1 minute for chart data
      enabled: Boolean(days),
      ...options,
    },
  );
}

/**
 * Get global DeFi-focused market data
 *
 * Fetches the same global cryptocurrency data as useGlobal but with a separate
 * cache key optimized for DeFi-specific use cases. This allows different components
 * to cache and refresh DeFi-related global metrics independently from general
 * global market data, providing better cache granularity for DeFi applications.
 *
 * Uses the same CoinGecko /global endpoint but maintains separate query cache
 * for scenarios where DeFi components need different refresh intervals or
 * cache invalidation strategies than general market overview components.
 *
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing global market data, loading state, and error info
 *
 * @example DeFi-specific global metrics
 * ```tsx
 * function DeFiGlobalMetrics() {
 *   const { data: globalData, isLoading } = useGlobalDefi();
 *
 *   if (isLoading) return <div>Loading DeFi global metrics...</div>;
 *   if (!globalData?.data) return <div>No DeFi data available</div>;
 *
 *   const { data } = globalData;
 *   const totalVolume = data.total_volume?.usd;
 *   const ethDominance = data.market_cap_percentage?.eth;
 *
 *   return (
 *     <div>
 *       <h3>DeFi Global Metrics</h3>
 *       <div>Total Volume: ${totalVolume?.toLocaleString()}</div>
 *       <div>Ethereum Dominance: {ethDominance?.toFixed(2)}%</div>
 *       <div>Active Cryptocurrencies: {data.active_cryptocurrencies}</div>
 *       <div>Market Cap Change: {data.market_cap_change_percentage_24h_usd?.toFixed(2)}%</div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Independent caching for DeFi dashboards
 * ```tsx
 * function DeFiDashboard() {
 *   // DeFi components use useGlobalDefi with longer cache time
 *   const { data: defiGlobal } = useGlobalDefi({
 *     staleTime: 10 * 60 * 1000, // 10 minutes for DeFi metrics
 *     refetchOnWindowFocus: false,
 *   });
 *
 *   // General market components use useGlobal with shorter cache time
 *   const { data: generalGlobal } = useGlobal({
 *     staleTime: 2 * 60 * 1000, // 2 minutes for general market
 *   });
 *
 *   return (
 *     <div>
 *       <DeFiMetrics data={defiGlobal} />
 *       <GeneralMarket data={generalGlobal} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Filtering DeFi-relevant metrics
 * ```tsx
 * function useDeFiMetrics() {
 *   const { data, ...queryResult } = useGlobalDefi();
 *
 *   const defiMetrics = useMemo(() => {
 *     if (!data?.data) return null;
 *
 *     const { total_market_cap, market_cap_percentage, total_volume } = data.data;
 *
 *     return {
 *       totalMarketCap: total_market_cap?.usd,
 *       totalVolume: total_volume?.usd,
 *       ethDominance: market_cap_percentage?.eth,
 *       adaDominance: market_cap_percentage?.ada,
 *       dotDominance: market_cap_percentage?.dot,
 *       // Focus on DeFi-relevant tokens
 *     };
 *   }, [data]);
 *
 *   return { defiMetrics, ...queryResult };
 * }
 * ```
 *
 * @see {@link useGlobal} for general global market data with separate caching
 * @see {@link useGlobalMarketCapChart} for historical DeFi market trends
 */
export function useGlobalDefi(
  options?: ExtendedQueryOptions<GlobalData> & CoinGeckoHookOptions,
): UseQueryResult<GlobalData, ApiError> {
  return useApiQuery<GlobalData>(
    coinGeckoQueryKeys.global.defiData(),
    "/api/coingecko/global",
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...options,
    },
  );
}
