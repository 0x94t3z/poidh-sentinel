/**
 * CoinGecko Exchanges API Hooks
 *
 * Comprehensive hooks for cryptocurrency exchange data including:
 * - List of all exchanges with trust scores and volume data
 * - Individual exchange details and tickers
 * - Exchange volume charts and analytics
 * - Exchange status updates and announcements
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { CoinGeckoHookOptions, Exchange } from "../types";
import type {
  ExtendedQueryOptions,
  ApiError,
} from "../../../private/api-hooks/types";
import type { UseQueryResult } from "@tanstack/react-query";

// ============================================================================
// Exchange Types
// ============================================================================

/**
 * Exchange ticker information for trading pairs
 */
export type ExchangeTicker = {
  base: string;
  target: string;
  market: {
    name: string;
    identifier: string;
    has_trading_incentive: boolean;
  };
  last: number;
  volume: number;
  converted_last: {
    btc: number;
    eth: number;
    usd: number;
  };
  converted_volume: {
    btc: number;
    eth: number;
    usd: number;
  };
  trust_score: string;
  bid_ask_spread_percentage: number;
  timestamp: string;
  last_traded_at: string;
  last_fetch_at: string;
  is_anomaly: boolean;
  is_stale: boolean;
  trade_url: string;
  token_info_url?: string;
  coin_id: string;
  target_coin_id?: string;
};

/**
 * Exchange tickers response structure
 */
export type ExchangeTickersResponse = {
  name: string;
  tickers: ExchangeTicker[];
};

/**
 * Exchange volume chart data structure
 */
export type ExchangeVolumeChart = Array<[number, string]>; // [timestamp, volume]

/**
 * Exchange list item for simple list endpoint
 */
export type ExchangeListItem = {
  id: string;
  name: string;
};

/**
 * Parameters for exchange list queries
 */
export type ExchangesListParams = {
  per_page?: number;
  page?: number;
};

/**
 * Parameters for exchange ticker queries
 */
export type ExchangeTickersParams = {
  coin_ids?: string;
  include_exchange_logo?: boolean;
  page?: number;
  depth?: boolean;
  order?: "trust_score_desc" | "trust_score_asc" | "volume_desc";
};

// ============================================================================
// Exchange List Hooks
// ============================================================================

/**
 * Get list of all supported cryptocurrency exchanges with comprehensive market data
 *
 * This hook fetches exchanges from CoinGecko API with trust scores, trading volumes,
 * establishment information, and ranking data for market analysis and comparison.
 *
 * @param params - Query parameters for filtering and pagination
 * @param params.per_page - Number of exchanges to return per page (default varies by API)
 * @param params.page - Page number for pagination (1-indexed)
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing array of exchange objects with trust scores and volume data
 *
 * @example
 * ```typescript
 * function ExchangesList() {
 *   const { data, isLoading, error } = useExchanges(
 *     { per_page: 50, page: 1 },
 *     { staleTime: 5 * 60 * 1000 }
 *   );
 *
 *   if (isLoading) return <div>Loading exchanges...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       {data?.map((exchange) => (
 *         <div key={exchange.id}>
 *           <h3>{exchange.name}</h3>
 *           <p>Trust Score: {exchange.trust_score}/10</p>
 *           <p>24h Volume: {exchange.trade_volume_24h_btc} BTC</p>
 *           <p>Country: {exchange.country}</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExchanges(
  params?: ExchangesListParams,
  options?: ExtendedQueryOptions<Exchange[]> & CoinGeckoHookOptions,
): UseQueryResult<Exchange[], ApiError> {
  const queryParams = new URLSearchParams();
  if (params?.per_page) queryParams.set("per_page", params.per_page.toString());
  if (params?.page) queryParams.set("page", params.page.toString());

  const url = queryParams.toString()
    ? `/api/coingecko/exchanges?${queryParams}`
    : "/api/coingecko/exchanges";

  return useApiQuery<Exchange[]>(
    coinGeckoQueryKeys.exchanges.list(params),
    url,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes
      ...options,
    },
  );
}

/**
 * Get comprehensive details for a specific cryptocurrency exchange
 *
 * This hook fetches complete exchange information including basic details,
 * social media links, trust metrics, trading volume data, and operational status.
 *
 * @param exchangeId - Unique identifier for the exchange (e.g., 'binance', 'coinbase_exchange')
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing detailed exchange information
 *
 * @example
 * ```typescript
 * function ExchangeProfile({ exchangeId }: { exchangeId: string }) {
 *   const { data, isLoading, error } = useExchange(exchangeId, {
 *     enabled: !!exchangeId,
 *     staleTime: 10 * 60 * 1000 // 10 minutes
 *   });
 *
 *   if (isLoading) return <div>Loading exchange details...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data) return <div>Exchange not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{data.name}</h1>
 *       <img src={data.image} alt={data.name} />
 *       <p>Trust Score: {data.trust_score}/10</p>
 *       <p>Established: {data.year_established}</p>
 *       <p>Country: {data.country}</p>
 *       <p>24h Volume: {data.trade_volume_24h_btc} BTC</p>
 *       <a href={data.url} target="_blank" rel="noopener noreferrer">
 *         Visit Exchange
 *       </a>
 *     </div>
 *   );
 * }
 * ```
 */
export function useExchange(
  exchangeId: string,
  options?: ExtendedQueryOptions<Exchange> & CoinGeckoHookOptions,
): UseQueryResult<Exchange, ApiError> {
  return useApiQuery<Exchange>(
    coinGeckoQueryKeys.exchanges.detail(exchangeId),
    `/api/coingecko/exchanges/${exchangeId}`,
    {
      enabled: Boolean(exchangeId?.trim()),
      staleTime: 10 * 60 * 1000, // 10 minutes
      gcTime: 60 * 60 * 1000, // 1 hour
      ...options,
    },
  );
}

/**
 * Get simplified list of all exchange IDs and names for dropdowns and selection
 *
 * This hook provides a lightweight endpoint for fetching basic exchange information,
 * optimized for use in form dropdowns, autocomplete components, and selection lists.
 * Data is cached for 24 hours due to its static nature.
 *
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing array of basic exchange info with id and name only
 *
 * @example
 * ```typescript
 * function ExchangeSelector({ onSelect }: { onSelect: (id: string) => void }) {
 *   const { data, isLoading } = useExchangesList({
 *     staleTime: 24 * 60 * 60 * 1000 // Cache for 24 hours
 *   });
 *
 *   if (isLoading) return <div>Loading exchanges...</div>;
 *
 *   return (
 *     <select onChange={(e) => onSelect(e.target.value)}>
 *       <option value="">Select an exchange</option>
 *       {data?.map((exchange) => (
 *         <option key={exchange.id} value={exchange.id}>
 *           {exchange.name}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 * ```
 */
export function useExchangesList(
  options?: ExtendedQueryOptions<ExchangeListItem[]> & CoinGeckoHookOptions,
): UseQueryResult<ExchangeListItem[], ApiError> {
  return useApiQuery<ExchangeListItem[]>(
    coinGeckoQueryKeys.exchanges.list(), // Using list() instead of simpleList() which doesn't exist
    "/api/coingecko/exchanges/list",
    {
      staleTime: 24 * 60 * 60 * 1000, // 24 hours
      gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
      ...options,
    },
  );
}

// ============================================================================
// Exchange Tickers Hooks
// ============================================================================

/**
 * Get trading pairs and ticker data for a specific cryptocurrency exchange
 *
 * This hook fetches real-time ticker information for all trading pairs on an exchange,
 * including prices, volumes, spreads, and trust scores for each market. Essential
 * for building trading interfaces and market analysis tools.
 *
 * @param exchangeId - Unique identifier for the exchange (e.g., 'binance', 'coinbase_exchange')
 * @param params - Query parameters for filtering and ordering ticker data
 * @param params.coin_ids - Comma-separated list of coin IDs to filter tickers (e.g., 'bitcoin,ethereum')
 * @param params.include_exchange_logo - Whether to include exchange logo URLs in response
 * @param params.page - Page number for pagination (1-indexed)
 * @param params.depth - Whether to include order book depth information
 * @param params.order - Sort order for tickers: trust_score_desc, trust_score_asc, or volume_desc
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing exchange name and array of ticker objects with pricing data
 *
 * @example
 * ```typescript
 * function ExchangeTickers({ exchangeId }: { exchangeId: string }) {
 *   const { data, isLoading, error } = useExchangeTickers(
 *     exchangeId,
 *     {
 *       coin_ids: 'bitcoin,ethereum',
 *       order: 'volume_desc',
 *       page: 1
 *     },
 *     { staleTime: 2 * 60 * 1000 } // 2 minutes
 *   );
 *
 *   if (isLoading) return <div>Loading tickers...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>{data?.name} Trading Pairs</h2>
 *       {data?.tickers.map((ticker) => (
 *         <div key={`${ticker.base}-${ticker.target}`}>
 *           <h3>{ticker.base}/{ticker.target}</h3>
 *           <p>Last Price: ${ticker.converted_last.usd}</p>
 *           <p>24h Volume: ${ticker.converted_volume.usd}</p>
 *           <p>Trust Score: {ticker.trust_score}</p>
 *           <p>Spread: {ticker.bid_ask_spread_percentage}%</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExchangeTickers(
  exchangeId: string,
  params?: ExchangeTickersParams,
  options?: ExtendedQueryOptions<ExchangeTickersResponse> &
    CoinGeckoHookOptions,
): UseQueryResult<ExchangeTickersResponse, ApiError> {
  const queryParams = new URLSearchParams();
  if (params?.coin_ids) queryParams.set("coin_ids", params.coin_ids);
  if (params?.include_exchange_logo)
    queryParams.set("include_exchange_logo", "true");
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.depth) queryParams.set("depth", "true");
  if (params?.order) queryParams.set("order", params.order);

  const url = queryParams.toString()
    ? `/api/coingecko/exchanges/${exchangeId}/tickers?${queryParams}`
    : `/api/coingecko/exchanges/${exchangeId}/tickers`;

  return useApiQuery<ExchangeTickersResponse>(
    coinGeckoQueryKeys.exchanges.tickers(exchangeId, params),
    url,
    {
      enabled: Boolean(exchangeId?.trim()),
      staleTime: 2 * 60 * 1000, // 2 minutes for real-time data
      gcTime: 15 * 60 * 1000, // 15 minutes
      ...options,
    },
  );
}

// ============================================================================
// Exchange Volume Charts
// ============================================================================

/**
 * Get historical trading volume chart data for a specific cryptocurrency exchange
 *
 * This hook fetches time-series volume data for creating charts and analyzing
 * exchange trading activity patterns over specified time periods. Essential
 * for market analysis dashboards and exchange comparison tools.
 *
 * @param exchangeId - Unique identifier for the exchange (e.g., 'binance', 'coinbase_exchange')
 * @param days - Number of days of historical data to fetch (1, 7, 14, 30, 90, 180, 365)
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing array of [timestamp, volume] pairs for charting
 *
 * @example
 * ```typescript
 * function ExchangeVolumeChart({ exchangeId }: { exchangeId: string }) {
 *   const { data, isLoading, error } = useExchangeVolumeChart(
 *     exchangeId,
 *     30, // Last 30 days
 *     { staleTime: 10 * 60 * 1000 }
 *   );
 *
 *   if (isLoading) return <div>Loading chart data...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const chartData = data?.map(([timestamp, volume]) => ({
 *     date: new Date(timestamp),
 *     volume: parseFloat(volume)
 *   })) || [];
 *
 *   // Render with your preferred chart library
 *   return <LineChart data={chartData} />;
 * }
 * ```
 */
export function useExchangeVolumeChart(
  exchangeId: string,
  days: number,
  options?: ExtendedQueryOptions<ExchangeVolumeChart> & CoinGeckoHookOptions,
): UseQueryResult<ExchangeVolumeChart, ApiError> {
  const queryParams = new URLSearchParams({
    days: days.toString(),
  });

  return useApiQuery<ExchangeVolumeChart>(
    coinGeckoQueryKeys.exchanges.volumeChart(exchangeId, days),
    `/api/coingecko/exchanges/${exchangeId}/volume-chart?${queryParams}`,
    {
      enabled: Boolean(exchangeId?.trim()) && days > 0,
      staleTime: 10 * 60 * 1000, // 10 minutes for historical data
      gcTime: 60 * 60 * 1000, // 1 hour
      ...options,
    },
  );
}

/**
 * Get historical trading volume chart data for a specific exchange within a custom date range
 *
 * This hook fetches time-series volume data for a specific time period defined by
 * Unix timestamps, allowing for precise historical analysis and custom chart ranges.
 * Perfect for detailed analysis and comparison tools.
 *
 * @param exchangeId - Unique identifier for the exchange (e.g., 'binance', 'coinbase_exchange')
 * @param from - Start Unix timestamp for the data range
 * @param to - End Unix timestamp for the data range
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing array of [timestamp, volume] pairs for the specified range
 *
 * @example
 * ```typescript
 * function CustomRangeVolumeChart({ exchangeId }: { exchangeId: string }) {
 *   const startDate = new Date('2024-01-01').getTime() / 1000;
 *   const endDate = new Date('2024-01-31').getTime() / 1000;
 *
 *   const { data, isLoading, error } = useExchangeVolumeChartRange(
 *     exchangeId,
 *     startDate,
 *     endDate,
 *     { staleTime: 30 * 60 * 1000 } // 30 minutes for historical data
 *   );
 *
 *   if (isLoading) return <div>Loading chart data...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const chartData = data?.map(([timestamp, volume]) => ({
 *     date: new Date(timestamp * 1000),
 *     volume: parseFloat(volume)
 *   })) || [];
 *
 *   return (
 *     <div>
 *       <h3>January 2024 Volume Data</h3>
 *       <LineChart data={chartData} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useExchangeVolumeChartRange(
  exchangeId: string,
  from: number,
  to: number,
  options?: ExtendedQueryOptions<ExchangeVolumeChart> & CoinGeckoHookOptions,
): UseQueryResult<ExchangeVolumeChart, ApiError> {
  const queryParams = new URLSearchParams({
    from: from.toString(),
    to: to.toString(),
  });

  return useApiQuery<ExchangeVolumeChart>(
    coinGeckoQueryKeys.exchanges.volumeChart(exchangeId, { from, to }), // Using volumeChart with params since volumeChartRange doesn't exist
    `/api/coingecko/exchanges/${exchangeId}/volume-chart/range?${queryParams}`,
    {
      enabled: Boolean(exchangeId?.trim()) && from > 0 && to > from,
      staleTime: 30 * 60 * 1000, // 30 minutes - historical data is stable
      gcTime: 2 * 60 * 60 * 1000, // 2 hours
      ...options,
    },
  );
}
