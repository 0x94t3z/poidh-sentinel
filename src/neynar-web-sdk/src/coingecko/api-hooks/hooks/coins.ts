/**
 * CoinGecko Coins API Hooks
 *
 * React Query hooks for CoinGecko coin-related operations.
 * Uses TanStack Query v5 with proper error handling, type safety, and hierarchical caching.
 *
 * This module provides comprehensive hooks for all coin-related CoinGecko API endpoints,
 * including queries for coin lists, market data, detailed coin information, historical charts,
 * and OHLC data. All hooks are optimized for performance with appropriate caching strategies.
 *
 * @example Basic Usage
 * ```typescript
 * import { useCoinsList, useCoinsMarkets, useCoin } from '@/neynar-web-sdk/api-hooks';
 *
 * function CoinsOverview() {
 *   const { data: coins, isLoading } = useCoinsList();
 *   const { data: markets } = useCoinsMarkets({ vs_currency: 'usd' });
 *   const { data: bitcoin } = useCoin('bitcoin');
 *
 *   if (isLoading) return <div>Loading coins...</div>;
 *
 *   return (
 *     <div>
 *       <h1>Top Coins</h1>
 *       {markets?.pages?.[0]?.map(coin => (
 *         <div key={coin.id}>
 *           <h3>{coin.name} ({coin.symbol})</h3>
 *           <p>Price: ${coin.current_price}</p>
 *           <p>Market Cap: ${coin.market_cap?.toLocaleString()}</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */

import { useApiQuery, useApiInfiniteQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type {
  Coin,
  CoinDetails,
  MarketChartData,
  OHLCData,
  MarketParams,
  ChartParams,
  CoinGeckoHookOptions,
} from "../types";
import type { UseQueryResult } from "@tanstack/react-query";
import type {
  ApiError,
  ExtendedQueryOptions,
} from "../../../private/api-hooks/types";

// ============================================================================
// Coin List Hooks
// ============================================================================

/**
 * Get comprehensive list of all supported coins
 *
 * Fetches the complete list of coins supported by CoinGecko API. This endpoint provides
 * the basic coin information including ID, symbol, and name that can be used for other
 * API calls. Cached for 24 hours as the coin list is relatively stable.
 *
 * @param params - Optional parameters to include platform information
 * @param params.include_platform - Whether to include platform contract addresses
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing coins list, loading state, and error info
 *
 * @example Basic coins list
 * ```typescript
 * function CoinsList() {
 *   const { data: coins, isLoading, error } = useCoinsList();
 *
 *   if (isLoading) return <div>Loading coins...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!coins?.length) return <div>No coins found</div>;
 *
 *   return (
 *     <div>
 *       <h2>All Coins ({coins.length})</h2>
 *       {coins.map(coin => (
 *         <div key={coin.id}>
 *           <strong>{coin.name}</strong> ({coin.symbol.toUpperCase()})
 *           <small>ID: {coin.id}</small>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With platform information for contract addresses
 * ```typescript
 * function CoinsWithContracts() {
 *   const { data: coins } = useCoinsList({ include_platform: true });
 *
 *   return (
 *     <div>
 *       {coins?.map(coin => (
 *         <div key={coin.id}>
 *           <h3>{coin.name}</h3>
 *           {coin.platforms && (
 *             <div>
 *               <h4>Contract Addresses:</h4>
 *               {Object.entries(coin.platforms).map(([platform, address]) => (
 *                 <p key={platform}>{platform}: {address}</p>
 *               ))}
 *             </div>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCoinsMarkets} for market data with pagination
 * @see {@link useCoin} for detailed individual coin information
 */
export function useCoinsList(
  params?: { include_platform?: boolean },
  options?: ExtendedQueryOptions<
    Array<{ id: string; symbol: string; name: string }>
  > &
    CoinGeckoHookOptions,
): UseQueryResult<
  Array<{ id: string; symbol: string; name: string }>,
  ApiError
> {
  const queryParams = new URLSearchParams();
  if (params?.include_platform) queryParams.set("include_platform", "true");

  return useApiQuery(
    coinGeckoQueryKeys.coins.list(params),
    `/api/coingecko/coins/list?${queryParams}`,
    {
      staleTime: 24 * 60 * 60 * 1000, // 24 hours - coin list is relatively stable
      ...options,
    },
  );
}

/**
 * Get coins market data with infinite scroll pagination
 *
 * Fetches market data for coins with comprehensive pricing, volume, and ranking information.
 * Uses infinite query pattern for efficient pagination, loading additional pages as needed.
 * Data is cached for 2 minutes due to the real-time nature of market information.
 *
 * @param params - Market data query parameters including currency and filtering options
 * @param params.vs_currency - Target currency for price data (default: 'usd')
 * @param params.order - Sort order for results (default: 'market_cap_desc')
 * @param params.per_page - Number of results per page (default: 50, max: 250)
 * @param params.ids - Comma-separated list of specific coin IDs to fetch
 * @param params.category - Filter by coin category
 * @param params.sparkline - Include sparkline price data (7 days)
 * @param params.price_change_percentage - Include price change percentages for specified timeframes
 * @param params.locale - Localization for number formatting
 * @param params.precision - Decimal precision for price data
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Infinite Query result with paginated market data, loading state, and error info
 *
 * @example Basic market data with infinite scroll
 * ```typescript
 * function MarketTable() {
 *   const {
 *     data,
 *     fetchNextPage,
 *     hasNextPage,
 *     isFetchingNextPage,
 *     isLoading,
 *   } = useCoinsMarkets({ vs_currency: 'usd', per_page: 50 });
 *
 *   if (isLoading) return <div>Loading market data...</div>;
 *
 *   const allCoins = data?.pages?.flat() || [];
 *
 *   return (
 *     <div>
 *       <h2>Cryptocurrency Market</h2>
 *       <table>
 *         <thead>
 *           <tr>
 *             <th>Rank</th>
 *             <th>Name</th>
 *             <th>Price</th>
 *             <th>24h Change</th>
 *             <th>Market Cap</th>
 *           </tr>
 *         </thead>
 *         <tbody>
 *           {allCoins.map(coin => (
 *             <tr key={coin.id}>
 *               <td>#{coin.market_cap_rank}</td>
 *               <td>
 *                 <img src={coin.image} alt={coin.name} width={24} />
 *                 {coin.name} ({coin.symbol.toUpperCase()})
 *               </td>
 *               <td>${coin.current_price?.toFixed(2)}</td>
 *               <td className={coin.price_change_percentage_24h > 0 ? 'positive' : 'negative'}>
 *                 {coin.price_change_percentage_24h?.toFixed(2)}%
 *               </td>
 *               <td>${coin.market_cap?.toLocaleString()}</td>
 *             </tr>
 *           ))}
 *         </tbody>
 *       </table>
 *       {hasNextPage && (
 *         <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
 *           {isFetchingNextPage ? 'Loading more...' : 'Load More'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Filtered market data by category
 * ```typescript
 * function DeFiCoins() {
 *   const { data, isLoading } = useCoinsMarkets({
 *     vs_currency: 'usd',
 *     category: 'decentralized-finance-defi',
 *     order: 'market_cap_desc',
 *     per_page: 20,
 *     sparkline: true,
 *     price_change_percentage: '1h,24h,7d'
 *   });
 *
 *   if (isLoading) return <div>Loading DeFi coins...</div>;
 *
 *   const defiCoins = data?.pages?.[0] || [];
 *
 *   return (
 *     <div>
 *       <h2>Top DeFi Coins</h2>
 *       {defiCoins.map(coin => (
 *         <div key={coin.id}>
 *           <h3>{coin.name}</h3>
 *           <p>Price: ${coin.current_price}</p>
 *           <p>24h: {coin.price_change_percentage_24h?.toFixed(2)}%</p>
 *           {coin.sparkline_in_7d && (
 *             <div>Sparkline data available for charting</div>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCoinsList} for the complete list of available coins
 * @see {@link useCoin} for detailed information about specific coins
 */
export function useCoinsMarkets(
  params: MarketParams,
  options?: CoinGeckoHookOptions,
) {
  return useApiInfiniteQuery<Coin>(
    coinGeckoQueryKeys.coins.markets(params),
    (page) => {
      const pageNum = typeof page === "number" ? page : 1;
      const queryParams = new URLSearchParams({
        vs_currency: params.vs_currency || "usd",
        order: params.order || "market_cap_desc",
        per_page: (params.per_page || 50).toString(),
        page: pageNum.toString(),
        ...(params.ids && { ids: params.ids }),
        ...(params.category && { category: params.category }),
        ...(params.sparkline && { sparkline: "true" }),
        ...(params.price_change_percentage && {
          price_change_percentage: params.price_change_percentage,
        }),
        ...(params.locale && { locale: params.locale }),
        ...(params.precision && { precision: params.precision.toString() }),
      });
      return `/api/coingecko/coins/markets?${queryParams}`;
    },
    {
      staleTime: 2 * 60 * 1000, // 2 minutes
      ...options,
    },
  );
}

// ============================================================================
// Individual Coin Data Hooks
// ============================================================================

/**
 * Get comprehensive information for a specific coin
 *
 * Fetches detailed coin information including description, links, market data,
 * community statistics, developer metrics, and more. This is the primary endpoint
 * for getting complete coin details. Data is cached for 5 minutes to balance
 * freshness with performance.
 *
 * @param id - The CoinGecko ID of the coin (e.g., 'bitcoin', 'ethereum')
 * @param params - Optional parameters to control data inclusion and localization
 * @param params.localization - Include localized descriptions (default: true)
 * @param params.tickers - Include ticker data from exchanges (default: true)
 * @param params.market_data - Include market data like prices and volumes (default: true)
 * @param params.community_data - Include community statistics (default: true)
 * @param params.developer_data - Include developer activity metrics (default: true)
 * @param params.sparkline - Include 7-day sparkline data (default: false)
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing detailed coin data, loading state, and error info
 *
 * @example Basic coin information display
 * ```typescript
 * function CoinDetail({ coinId }: { coinId: string }) {
 *   const { data: coin, isLoading, error } = useCoin(coinId);
 *
 *   if (isLoading) return <div>Loading {coinId}...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!coin) return <div>Coin not found</div>;
 *
 *   return (
 *     <div>
 *       <div className="coin-header">
 *         <img src={coin.image?.large} alt={coin.name} width={64} />
 *         <div>
 *           <h1>{coin.name} ({coin.symbol?.toUpperCase()})</h1>
 *           <p>Rank: #{coin.market_cap_rank}</p>
 *         </div>
 *       </div>
 *
 *       <div className="coin-stats">
 *         <h2>Market Data</h2>
 *         <p>Current Price: ${coin.market_data?.current_price?.usd}</p>
 *         <p>Market Cap: ${coin.market_data?.market_cap?.usd?.toLocaleString()}</p>
 *         <p>24h Volume: ${coin.market_data?.total_volume?.usd?.toLocaleString()}</p>
 *         <p>24h Change: {coin.market_data?.price_change_percentage_24h?.toFixed(2)}%</p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Minimal data for performance optimization
 * ```typescript
 * function QuickCoinInfo({ coinId }: { coinId: string }) {
 *   const { data: coin } = useCoin(coinId, {
 *     localization: false,
 *     tickers: false,
 *     community_data: false,
 *     developer_data: false
 *   });
 *
 *   if (!coin) return null;
 *
 *   return (
 *     <div>
 *       <h2>{coin.name}</h2>
 *       <p>Price: ${coin.market_data?.current_price?.usd}</p>
 *       <p>Market Cap Rank: #{coin.market_cap_rank}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCoinMarketChart} for detailed historical price charts
 * @see {@link useCoinsMarkets} for market data across multiple coins
 * @see {@link useCoinOHLC} for OHLC trading data
 */
export function useCoin(
  id: string,
  params?: {
    localization?: boolean;
    tickers?: boolean;
    market_data?: boolean;
    community_data?: boolean;
    developer_data?: boolean;
    sparkline?: boolean;
  },
  options?: ExtendedQueryOptions<CoinDetails> & CoinGeckoHookOptions,
): UseQueryResult<CoinDetails, ApiError> {
  const queryParams = new URLSearchParams();
  if (params?.localization === false) queryParams.set("localization", "false");
  if (params?.tickers === false) queryParams.set("tickers", "false");
  if (params?.market_data === false) queryParams.set("market_data", "false");
  if (params?.community_data === false)
    queryParams.set("community_data", "false");
  if (params?.developer_data === false)
    queryParams.set("developer_data", "false");
  if (params?.sparkline) queryParams.set("sparkline", "true");

  return useApiQuery<CoinDetails>(
    coinGeckoQueryKeys.coins.detail(id, params),
    `/api/coingecko/coins/${id}?${queryParams}`,
    {
      enabled: Boolean(id?.trim()),
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...options,
    },
  );
}

// ============================================================================
// Historical Data Hooks
// ============================================================================

/**
 * Get historical market chart data for a coin
 *
 * Fetches historical price, market cap, and volume data for charting and analysis.
 * Returns time series data in arrays of [timestamp, value] pairs. Data granularity
 * automatically adjusts based on the requested time period. Cached for 1 minute
 * due to the real-time nature of market data.
 *
 * @param id - The CoinGecko ID of the coin (e.g., 'bitcoin', 'ethereum')
 * @param params - Chart data parameters including currency, timeframe, and precision
 * @param params.vs_currency - Target currency for price data (default: 'usd')
 * @param params.days - Number of days of historical data (default: '7')
 * @param params.interval - Data point interval ('minutely', 'hourly', 'daily')
 * @param params.precision - Decimal places for price values
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing chart data, loading state, and error info
 *
 * @example Basic price chart data fetching
 * ```typescript
 * function CoinChart({ coinId }: { coinId: string }) {
 *   const { data: chartData, isLoading } = useCoinMarketChart(coinId, {
 *     vs_currency: 'usd',
 *     days: '30'
 *   });
 *
 *   if (isLoading) return <div>Loading chart...</div>;
 *   if (!chartData) return <div>No chart data available</div>;
 *
 *   return (
 *     <div>
 *       <h2>Price Chart (30 Days)</h2>
 *       <div className="chart-stats">
 *         <p>Data points: {chartData.prices.length}</p>
 *         <p>Latest price: ${chartData.prices[chartData.prices.length - 1]?.[1]}</p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Multi-metric dashboard data
 * ```typescript
 * function CoinDashboard({ coinId }: { coinId: string }) {
 *   const { data: chartData } = useCoinMarketChart(coinId, {
 *     vs_currency: 'usd',
 *     days: '7',
 *     interval: 'hourly'
 *   });
 *
 *   if (!chartData) return <div>Loading dashboard...</div>;
 *
 *   const latestPrice = chartData.prices[chartData.prices.length - 1]?.[1];
 *   const latestVolume = chartData.total_volumes[chartData.total_volumes.length - 1]?.[1];
 *   const latestMarketCap = chartData.market_caps[chartData.market_caps.length - 1]?.[1];
 *
 *   return (
 *     <div className="dashboard">
 *       <div className="metrics">
 *         <div>Current Price: ${latestPrice?.toFixed(2)}</div>
 *         <div>24h Volume: ${latestVolume?.toLocaleString()}</div>
 *         <div>Market Cap: ${latestMarketCap?.toLocaleString()}</div>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCoinMarketChartRange} for custom date range charts
 * @see {@link useCoinOHLC} for OHLC trading data
 * @see {@link useCoin} for current market data and coin details
 */
export function useCoinMarketChart(
  id: string,
  params: ChartParams,
  options?: ExtendedQueryOptions<MarketChartData> & CoinGeckoHookOptions,
): UseQueryResult<MarketChartData, ApiError> {
  const queryParams = new URLSearchParams({
    vs_currency: params.vs_currency || "usd",
    days: (params.days || "7").toString(),
    ...(params.interval && { interval: params.interval }),
    ...(params.precision && { precision: params.precision.toString() }),
  });

  return useApiQuery<MarketChartData>(
    coinGeckoQueryKeys.coins.marketChart(
      id,
      params.vs_currency || "usd",
      params.days || "7",
      params,
    ),
    `/api/coingecko/coins/${id}/market-chart?${queryParams}`,
    {
      enabled: Boolean(id?.trim()),
      staleTime: 60 * 1000, // 1 minute
      ...options,
    },
  );
}

/**
 * Get historical market data for a custom date range
 *
 * Fetches historical price, market cap, and volume data between specific timestamps.
 * Useful for analyzing performance during specific time periods or events.
 * Data granularity automatically adjusts based on the range duration. Historical
 * data is cached for 5 minutes as it's relatively stable.
 *
 * @param id - The CoinGecko ID of the coin (e.g., 'bitcoin', 'ethereum')
 * @param vsCurrency - Target currency for price data (e.g., 'usd', 'eur', 'btc')
 * @param from - Start timestamp in Unix format (seconds since epoch)
 * @param to - End timestamp in Unix format (seconds since epoch)
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing chart data for the specified range
 *
 * @example Custom date range analysis
 * ```typescript
 * function EventAnalysis({ coinId }: { coinId: string }) {
 *   // Analyze price during a specific event (e.g., Bitcoin halving)
 *   const halvingDate = new Date('2024-04-20').getTime() / 1000;
 *   const beforeHalving = halvingDate - (30 * 24 * 60 * 60); // 30 days before
 *   const afterHalving = halvingDate + (30 * 24 * 60 * 60);  // 30 days after
 *
 *   const { data: chartData, isLoading } = useCoinMarketChartRange(
 *     coinId,
 *     'usd',
 *     beforeHalving,
 *     afterHalving
 *   );
 *
 *   if (isLoading) return <div>Loading event analysis...</div>;
 *   if (!chartData) return <div>No data available for this period</div>;
 *
 *   const beforePrice = chartData.prices.find(([timestamp]) =>
 *     timestamp <= halvingDate * 1000
 *   )?.[1];
 *   const afterPrice = chartData.prices[chartData.prices.length - 1]?.[1];
 *   const change = beforePrice && afterPrice ?
 *     ((afterPrice - beforePrice) / beforePrice * 100) : 0;
 *
 *   return (
 *     <div>
 *       <h2>Halving Event Analysis</h2>
 *       <div className="metrics">
 *         <p>Price before: ${beforePrice?.toFixed(2)}</p>
 *         <p>Price after: ${afterPrice?.toFixed(2)}</p>
 *         <p>Change: {change.toFixed(2)}%</p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Portfolio performance tracking
 * ```typescript
 * function PortfolioTracker({ coinId, purchaseDate }: {
 *   coinId: string;
 *   purchaseDate: Date;
 * }) {
 *   const purchaseTimestamp = purchaseDate.getTime() / 1000;
 *   const currentTimestamp = Date.now() / 1000;
 *
 *   const { data: performanceData } = useCoinMarketChartRange(
 *     coinId,
 *     'usd',
 *     purchaseTimestamp,
 *     currentTimestamp
 *   );
 *
 *   if (!performanceData) return <div>Loading performance...</div>;
 *
 *   const purchasePrice = performanceData.prices[0]?.[1];
 *   const currentPrice = performanceData.prices[performanceData.prices.length - 1]?.[1];
 *   const totalReturn = purchasePrice && currentPrice ?
 *     ((currentPrice - purchasePrice) / purchasePrice * 100) : 0;
 *
 *   return (
 *     <div className="portfolio-tracker">
 *       <h2>Investment Performance</h2>
 *       <div className="performance-metrics">
 *         <p>Purchase Price: ${purchasePrice?.toFixed(2)}</p>
 *         <p>Current Price: ${currentPrice?.toFixed(2)}</p>
 *         <p>Total Return: {totalReturn.toFixed(2)}%</p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCoinMarketChart} for predefined time periods
 * @see {@link useCoinOHLC} for OHLC trading data in custom ranges
 */
export function useCoinMarketChartRange(
  id: string,
  vsCurrency: string,
  from: number,
  to: number,
  options?: ExtendedQueryOptions<MarketChartData> & CoinGeckoHookOptions,
): UseQueryResult<MarketChartData, ApiError> {
  const queryParams = new URLSearchParams({
    vs_currency: vsCurrency,
    from: from.toString(),
    to: to.toString(),
  });

  return useApiQuery<MarketChartData>(
    coinGeckoQueryKeys.coins.marketChartRange(id, vsCurrency, from, to),
    `/api/coingecko/coins/${id}/market-chart/range?${queryParams}`,
    {
      enabled: Boolean(id?.trim()) && from > 0 && to > from,
      staleTime: 5 * 60 * 1000, // 5 minutes - historical data is stable
      ...options,
    },
  );
}

/**
 * Get OHLC (Open, High, Low, Close) candlestick data for a coin
 *
 * Fetches Open, High, Low, Close price data suitable for candlestick charts and
 * technical analysis. Each data point represents aggregated price action for the
 * specified time period. Data granularity depends on the requested days parameter.
 * Cached for 5 minutes to balance freshness with performance.
 *
 * Data granularity by period:
 * - 1 day: 30-minute intervals
 * - 7-30 days: 4-hour intervals
 * - 31-90 days: 12-hour intervals
 * - 91+ days: 1-day intervals
 *
 * @param id - The CoinGecko ID of the coin (e.g., 'bitcoin', 'ethereum')
 * @param vsCurrency - Target currency for price data (e.g., 'usd', 'eur', 'btc')
 * @param days - Number of days of OHLC data (1, 7, 14, 30, 90, 180, 365)
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing OHLC data array, loading state, and error info
 *
 * @example Candlestick chart component
 * ```typescript
 * function CandlestickChart({ coinId }: { coinId: string }) {
 *   const { data: ohlcData, isLoading } = useCoinOHLC(coinId, 'usd', 30);
 *
 *   if (isLoading) return <div>Loading OHLC data...</div>;
 *   if (!ohlcData?.length) return <div>No OHLC data available</div>;
 *
 *   // Transform OHLC data for charting library
 *   const candlestickData = ohlcData.map(([timestamp, open, high, low, close]) => ({
 *     x: new Date(timestamp),
 *     y: [open, high, low, close]
 *   }));
 *
 *   return (
 *     <div>
 *       <h2>30-Day Candlestick Chart</h2>
 *       <div className="ohlc-summary">
 *         <h3>Latest OHLC</h3>
 *         {ohlcData[ohlcData.length - 1] && (
 *           <div className="ohlc-values">
 *             <p>Open: ${ohlcData[ohlcData.length - 1][1]?.toFixed(2)}</p>
 *             <p>High: ${ohlcData[ohlcData.length - 1][2]?.toFixed(2)}</p>
 *             <p>Low: ${ohlcData[ohlcData.length - 1][3]?.toFixed(2)}</p>
 *             <p>Close: ${ohlcData[ohlcData.length - 1][4]?.toFixed(2)}</p>
 *           </div>
 *         )}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Technical analysis with OHLC data
 * ```typescript
 * function TechnicalAnalysis({ coinId }: { coinId: string }) {
 *   const { data: weeklyOHLC } = useCoinOHLC(coinId, 'usd', 7);
 *   const { data: monthlyOHLC } = useCoinOHLC(coinId, 'usd', 30);
 *
 *   const calculateVolatility = (ohlcData: OHLCData[]) => {
 *     if (!ohlcData?.length) return 0;
 *     const dailyRanges = ohlcData.map(([, , high, low]) =>
 *       ((high - low) / low * 100)
 *     );
 *     return dailyRanges.reduce((sum, range) => sum + range, 0) / dailyRanges.length;
 *   };
 *
 *   const weeklyVolatility = calculateVolatility(weeklyOHLC || []);
 *   const monthlyVolatility = calculateVolatility(monthlyOHLC || []);
 *
 *   return (
 *     <div className="technical-analysis">
 *       <h2>Technical Analysis Dashboard</h2>
 *       <div className="volatility-metrics">
 *         <div>7-Day Avg Volatility: {weeklyVolatility.toFixed(2)}%</div>
 *         <div>30-Day Avg Volatility: {monthlyVolatility.toFixed(2)}%</div>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCoinMarketChart} for line chart price data
 * @see {@link useCoinMarketChartRange} for custom date range OHLC
 * @see {@link useCoin} for current market data and coin details
 */
export function useCoinOHLC(
  id: string,
  vsCurrency: string,
  days: number,
  options?: ExtendedQueryOptions<OHLCData[]> & CoinGeckoHookOptions,
): UseQueryResult<OHLCData[], ApiError> {
  const queryParams = new URLSearchParams({
    vs_currency: vsCurrency,
    days: days.toString(),
  });

  return useApiQuery<OHLCData[]>(
    coinGeckoQueryKeys.coins.ohlc(id, vsCurrency, days),
    `/api/coingecko/coins/${id}/ohlc?${queryParams}`,
    {
      enabled: Boolean(id?.trim()) && days > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...options,
    },
  );
}
