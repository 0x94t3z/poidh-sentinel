/**
 * CoinGecko Derivatives API Hooks
 *
 * Comprehensive hooks for cryptocurrency derivatives data including:
 * - Derivatives market overview and ticker data
 * - Derivatives exchanges with trading volumes and metrics
 * - Individual exchange details and trading pairs
 * - Exchange listings and directory information
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { CoinGeckoHookOptions } from "../types";
import type {
  ExtendedQueryOptions,
  QueryHookResult,
} from "../../../private/api-hooks/types";

// ============================================================================
// Derivatives Types
// ============================================================================

/**
 * Individual derivative ticker data structure
 */
type DerivativeTicker = {
  /** Market symbol identifier */
  symbol: string;
  /** Base trading pair identifier */
  base: string;
  /** Target trading pair identifier */
  target: string;
  /** Exchange hosting this derivative */
  market: string;
  /** Current price in USD */
  last: number;
  /** 24 hour trading volume */
  volume: number;
  /** Open interest in USD */
  open_interest_usd: number;
  /** Contract type (perpetual, futures, etc.) */
  contract_type: string;
  /** Contract expiry date if applicable */
  expired_at?: string | null;
  /** Basis percentage */
  basis: number;
  /** Spread percentage */
  spread: number;
  /** Funding rate for perpetual contracts */
  funding_rate: number;
  /** Price change in 24 hours */
  price_change_24h?: number;
  /** Price change percentage in 24 hours */
  price_change_percentage_24h?: number;
  /** Last update timestamp */
  last_traded_at: string;
};

/**
 * Derivatives market overview data structure
 */
type DerivativesOverview = {
  /** Total open interest across all derivatives in USD */
  total_open_interest_usd: number;
  /** 24 hour trading volume across all derivatives in USD */
  total_volume_24h_usd: number;
  /** Market cap dominance percentage */
  market_cap_percentage: number;
  /** List of derivative tickers */
  data: DerivativeTicker[];
};

/**
 * Derivatives exchange information
 */
type DerivativesExchange = {
  /** Exchange unique identifier */
  id: string;
  /** Exchange display name */
  name: string;
  /** Establishment year */
  year_established?: number | null;
  /** Country of operation */
  country?: string | null;
  /** Exchange description */
  description?: string | null;
  /** Official website URL */
  url: string;
  /** Logo image URL */
  image: string;
  /** 24 hour trading volume in BTC */
  trade_volume_24h_btc: number;
  /** Number of active perpetual trading pairs */
  number_of_perpetual_pairs: number;
  /** Number of active futures trading pairs */
  number_of_futures_pairs: number;
  /** Open interest in BTC */
  open_interest_btc: number;
};

/**
 * Detailed derivatives exchange with trading pairs
 */
type DerivativesExchangeDetails = DerivativesExchange & {
  /** List of trading pairs/tickers on this exchange */
  tickers: DerivativeTicker[];
};

/**
 * Simplified exchange information for listings
 */
type DerivativesExchangeListItem = {
  /** Exchange unique identifier */
  id: string;
  /** Exchange display name */
  name: string;
};

// ============================================================================
// Derivatives Market Overview Hooks
// ============================================================================

/**
 * Get comprehensive derivatives market overview with ticker data
 *
 * This hook fetches the complete derivatives market landscape including open interest,
 * trading volumes, and individual ticker information across all supported exchanges.
 * Essential for derivatives market analysis and portfolio tracking.
 *
 * @param params - Query parameters for filtering derivatives data
 * @param params.include_tickers - Whether to include individual ticker data: 'all', 'unexpired', or exclude
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing derivatives market overview with tickers and volume data
 *
 * @example
 * ```typescript
 * function DerivativesMarketOverview() {
 *   const { data, isLoading, error } = useDerivatives(
 *     { include_tickers: 'unexpired' },
 *     { staleTime: 2 * 60 * 1000 }
 *   );
 *
 *   if (isLoading) return <div>Loading derivatives data...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data?.data) return <div>No derivatives data available</div>;
 *
 *   const overview = data.data;
 *   return (
 *     <div>
 *       <h2>Derivatives Market Overview</h2>
 *       <p>Total Open Interest: ${overview.total_open_interest_usd.toLocaleString()}</p>
 *       <p>24h Volume: ${overview.total_volume_24h_usd.toLocaleString()}</p>
 *       <div>
 *         <h3>Active Contracts ({overview.data.length})</h3>
 *         {overview.data.map((ticker, index) => (
 *           <div key={index}>
 *             <strong>{ticker.symbol}</strong> on {ticker.market}
 *             <p>Price: ${ticker.last.toLocaleString()}</p>
 *             <p>Open Interest: ${ticker.open_interest_usd.toLocaleString()}</p>
 *             <p>Funding Rate: {(ticker.funding_rate * 100).toFixed(4)}%</p>
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDerivatives(
  params?: {
    /** Include ticker data: 'all', 'unexpired', or omit to exclude tickers */
    include_tickers?: "all" | "unexpired" | string;
  },
  options?: ExtendedQueryOptions<DerivativesOverview> & CoinGeckoHookOptions,
): QueryHookResult<DerivativesOverview> {
  const queryParams = new URLSearchParams();
  if (params?.include_tickers) {
    queryParams.set("include_tickers", params.include_tickers);
  }

  return useApiQuery<DerivativesOverview>(
    coinGeckoQueryKeys.derivatives.list(params),
    `/api/coingecko/derivatives?${queryParams}`,
    {
      staleTime: 2 * 60 * 1000, // 2 minutes - derivatives data changes frequently
      gcTime: 10 * 60 * 1000, // 10 minutes
      ...options,
    },
  );
}

// ============================================================================
// Derivatives Exchanges Directory Hooks
// ============================================================================

/**
 * Get paginated list of derivatives exchanges with trading metrics
 *
 * This hook fetches a comprehensive directory of cryptocurrency derivatives exchanges
 * including trading volumes, open interest, and the number of trading pairs available.
 * Perfect for exchange comparison and market analysis.
 *
 * @param params - Pagination and ordering parameters for exchanges list
 * @param params.order - Sort order: 'open_interest_btc_desc', 'open_interest_btc_asc', 'name_desc', 'name_asc'
 * @param params.per_page - Number of exchanges to return per page (1-250, default 100)
 * @param params.page - Page number for pagination (1-indexed, default 1)
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing array of derivatives exchanges with trading metrics
 *
 * @example
 * ```typescript
 * function DerivativesExchangesList() {
 *   const { data, isLoading, error } = useDerivativesExchanges(
 *     {
 *       order: 'open_interest_btc_desc',
 *       per_page: 20,
 *       page: 1
 *     },
 *     { staleTime: 5 * 60 * 1000 }
 *   );
 *
 *   if (isLoading) return <div>Loading exchanges...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Top Derivatives Exchanges</h2>
 *       {data?.map((exchange, index) => (
 *         <div key={exchange.id}>
 *           <h3>#{index + 1} {exchange.name}</h3>
 *           <img src={exchange.image} alt={exchange.name} width={32} height={32} />
 *           <p>Open Interest: {exchange.open_interest_btc} BTC</p>
 *           <p>24h Volume: {exchange.trade_volume_24h_btc} BTC</p>
 *           <p>Perpetual Pairs: {exchange.number_of_perpetual_pairs}</p>
 *           <p>Futures Pairs: {exchange.number_of_futures_pairs}</p>
 *           <p>Established: {exchange.year_established || 'Unknown'}</p>
 *           <p>Country: {exchange.country || 'Global'}</p>
 *           <a href={exchange.url} target="_blank" rel="noopener noreferrer">
 *             Visit Exchange →
 *           </a>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDerivativesExchanges(
  params?: {
    /** Sort order for exchanges list */
    order?:
      | "open_interest_btc_desc"
      | "open_interest_btc_asc"
      | "name_desc"
      | "name_asc"
      | string;
    /** Number of exchanges per page (1-250) */
    per_page?: number;
    /** Page number (1-indexed) */
    page?: number;
  },
  options?: ExtendedQueryOptions<DerivativesExchange[]> & CoinGeckoHookOptions,
): QueryHookResult<DerivativesExchange[]> {
  const queryParams = new URLSearchParams();
  if (params?.order) queryParams.set("order", params.order);
  if (params?.per_page) queryParams.set("per_page", params.per_page.toString());
  if (params?.page) queryParams.set("page", params.page.toString());

  return useApiQuery<DerivativesExchange[]>(
    coinGeckoQueryKeys.derivatives.exchanges.list(params),
    `/api/coingecko/derivatives/exchanges?${queryParams}`,
    {
      staleTime: 5 * 60 * 1000, // 5 minutes - exchange rankings change slowly
      gcTime: 30 * 60 * 1000, // 30 minutes
      ...options,
    },
  );
}

// ============================================================================
// Individual Derivatives Exchange Hooks
// ============================================================================

/**
 * Get comprehensive details for a specific derivatives exchange
 *
 * This hook fetches complete information about a derivatives exchange including
 * all available trading pairs, ticker data, open interest, and exchange metrics.
 * Ideal for detailed exchange analysis and trading pair discovery.
 *
 * @param exchangeId - Unique identifier for the derivatives exchange (e.g., 'bybit', 'binance_futures')
 * @param params - Query parameters for exchange details
 * @param params.include_tickers - Whether to include trading pair ticker data: 'all', 'unexpired'
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing detailed exchange information with trading pairs
 *
 * @example
 * ```typescript
 * function DerivativesExchangeDetails({ exchangeId }: { exchangeId: string }) {
 *   const { data, isLoading, error } = useDerivativesExchange(
 *     exchangeId,
 *     { include_tickers: 'unexpired' },
 *     {
 *       enabled: !!exchangeId,
 *       staleTime: 5 * 60 * 1000
 *     }
 *   );
 *
 *   if (isLoading) return <div>Loading exchange details...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data) return <div>Exchange not found</div>;
 *
 *   return (
 *     <div>
 *       <h1>{data.name} Derivatives</h1>
 *       <div>
 *         <img src={data.image} alt={data.name} width={64} height={64} />
 *         <p>{data.description}</p>
 *         <p>Total Open Interest: {data.open_interest_btc} BTC</p>
 *         <p>24h Volume: {data.trade_volume_24h_btc} BTC</p>
 *         <p>Trading Pairs: {data.tickers.length}</p>
 *       </div>
 *
 *       <div>
 *         <h3>Active Trading Pairs</h3>
 *         {data.tickers.map((ticker, index) => (
 *           <div key={index}>
 *             <h4>{ticker.symbol} ({ticker.contract_type})</h4>
 *             <p>Price: ${ticker.last.toLocaleString()}</p>
 *             <p>24h Change: {ticker.price_change_percentage_24h?.toFixed(2)}%</p>
 *             <p>Volume: ${ticker.volume.toLocaleString()}</p>
 *             <p>Open Interest: ${ticker.open_interest_usd.toLocaleString()}</p>
 *             <p>Funding Rate: {(ticker.funding_rate * 100).toFixed(4)}%</p>
 *             {ticker.expired_at && (
 *               <p>Expires: {new Date(ticker.expired_at).toLocaleDateString()}</p>
 *             )}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDerivativesExchange(
  exchangeId: string,
  params?: {
    /** Include ticker data: 'all', 'unexpired', or omit to exclude tickers */
    include_tickers?: "all" | "unexpired" | string;
  },
  options?: ExtendedQueryOptions<DerivativesExchangeDetails> &
    CoinGeckoHookOptions,
): QueryHookResult<DerivativesExchangeDetails> {
  const queryParams = new URLSearchParams();
  if (params?.include_tickers) {
    queryParams.set("include_tickers", params.include_tickers);
  }

  return useApiQuery<DerivativesExchangeDetails>(
    coinGeckoQueryKeys.derivatives.exchanges.detail(exchangeId, params),
    `/api/coingecko/derivatives/exchanges/${exchangeId}?${queryParams}`,
    {
      enabled: Boolean(exchangeId?.trim()),
      staleTime: 5 * 60 * 1000, // 5 minutes - exchange data relatively stable
      gcTime: 30 * 60 * 1000, // 30 minutes
      ...options,
    },
  );
}

// ============================================================================
// Derivatives Exchanges Directory Hooks
// ============================================================================

/**
 * Get simplified list of all derivatives exchange IDs and names for dropdowns and selection
 *
 * This hook provides a lightweight endpoint for fetching basic derivatives exchange information,
 * optimized for use in form dropdowns, autocomplete components, and selection lists.
 * Contains only essential data for UI components without heavy trading metrics.
 *
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing array of basic exchange info with id and name only
 *
 * @example
 * ```typescript
 * function DerivativesExchangeSelector({
 *   onSelect
 * }: {
 *   onSelect: (exchangeId: string, exchangeName: string) => void
 * }) {
 *   const { data, isLoading } = useDerivativesExchangesList({
 *     staleTime: 24 * 60 * 60 * 1000 // Cache for 24 hours
 *   });
 *
 *   if (isLoading) return <div>Loading exchanges...</div>;
 *
 *   return (
 *     <select
 *       onChange={(e) => {
 *         const selectedExchange = data?.find(ex => ex.id === e.target.value);
 *         if (selectedExchange) {
 *           onSelect(selectedExchange.id, selectedExchange.name);
 *         }
 *       }}
 *     >
 *       <option value="">Select a derivatives exchange</option>
 *       {data?.map((exchange) => (
 *         <option key={exchange.id} value={exchange.id}>
 *           {exchange.name}
 *         </option>
 *       ))}
 *     </select>
 *   );
 * }
 *
 * // Usage in a trading interface
 * function TradingDashboard() {
 *   const [selectedExchange, setSelectedExchange] = useState<string>('');
 *
 *   const handleExchangeSelect = (id: string, name: string) => {
 *     setSelectedExchange(id);
 *     // Load trading pairs for selected exchange
 *   };
 *
 *   return (
 *     <div>
 *       <DerivativesExchangeSelector onSelect={handleExchangeSelect} />
 *       {selectedExchange && (
 *         <DerivativesExchangeDetails exchangeId={selectedExchange} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useDerivativesExchangesList(
  options?: ExtendedQueryOptions<DerivativesExchangeListItem[]> &
    CoinGeckoHookOptions,
): QueryHookResult<DerivativesExchangeListItem[]> {
  return useApiQuery<DerivativesExchangeListItem[]>(
    coinGeckoQueryKeys.derivatives.exchanges.simpleList(),
    "/api/coingecko/derivatives/exchanges/list",
    {
      staleTime: 24 * 60 * 60 * 1000, // 24 hours - exchange directory changes infrequently
      gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days - safe to keep in cache long-term
      ...options,
    },
  );
}
