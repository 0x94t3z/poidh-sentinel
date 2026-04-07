/**
 * CoinGecko Simple API Hooks
 *
 * Most commonly used CoinGecko endpoints for price data and basic information.
 * The simple API provides the most efficient way to get current price data for multiple coins
 * without the overhead of comprehensive market data. Perfect for price tickers, portfolio tracking,
 * and basic price displays.
 *
 * Features:
 * - Real-time price data across multiple currencies
 * - Token price lookups by contract address
 * - Supported currency lists for validation
 * - Optimized for frequent updates with appropriate caching
 */

import type { UseQueryResult } from "@tanstack/react-query";
import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { SimplePriceData, CoinGeckoHookOptions } from "../types";
import type {
  ExtendedQueryOptions,
  ApiError,
} from "../../../private/api-hooks/types";

// ============================================================================
// Simple Price Data Types
// ============================================================================

/**
 * Parameters for simple price requests with enhanced market data options
 */
export type SimplePriceOptions = {
  /** Include market capitalization data for each coin */
  includeMarketCap?: boolean;
  /** Include 24-hour trading volume data */
  include24hrVol?: boolean;
  /** Include 24-hour percentage change data */
  include24hrChange?: boolean;
  /** Include timestamp of last price update */
  includeLastUpdatedAt?: boolean;
  /** Decimal precision for returned prices (e.g., 'full', '2') */
  precision?: string;
};

/**
 * Parameters for token price requests by contract address
 */
export type TokenPriceOptions = SimplePriceOptions & {
  /** Blockchain network identifier (e.g., 'ethereum', 'polygon-pos') */
  network: string;
  /** Array of contract addresses to fetch prices for */
  contractAddresses: string[];
  /** Array of target currencies for price conversion */
  vsCurrencies: string[];
};

// ============================================================================
// Simple Price Hooks
// ============================================================================

/**
 * Fetches current price data for multiple cryptocurrencies across multiple currencies
 *
 * This is the most efficient hook for getting real-time price information without
 * the overhead of comprehensive market data. Ideal for price tickers, portfolio displays,
 * and applications requiring frequent price updates with minimal data transfer.
 *
 * The hook automatically handles comma-separated ID formatting and provides intelligent
 * caching with 30-second stale time to balance data freshness with API efficiency.
 *
 * @param ids - Array of coin IDs to fetch prices for (e.g., ['bitcoin', 'ethereum', 'cardano'])
 * @param vsCurrencies - Array of target currencies for price conversion (e.g., ['usd', 'eur', 'btc'])
 * @param options - Configuration options for additional market data and price formatting
 * @param options.includeMarketCap - Include market capitalization for each coin
 * @param options.include24hrVol - Include 24-hour trading volume data
 * @param options.include24hrChange - Include 24-hour percentage change data
 * @param options.includeLastUpdatedAt - Include timestamp of last price update
 * @param options.precision - Control decimal precision of returned prices
 * @param queryOptions - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result with price data in nested object structure
 *
 * @example
 * ```typescript
 * // Basic price fetching for major cryptocurrencies
 * const { data: prices, isLoading, error } = useSimplePrice(
 *   ['bitcoin', 'ethereum', 'cardano'],
 *   ['usd', 'eur', 'btc'],
 *   {
 *     includeMarketCap: true,
 *     include24hrChange: true,
 *     precision: '2',
 *   },
 *   {
 *     refetchInterval: 30000, // Refetch every 30 seconds for live prices
 *     staleTime: 15000, // Consider data stale after 15 seconds
 *   }
 * );
 *
 * // Access specific price data:
 * const bitcoinPriceUsd = prices?.bitcoin?.usd;
 * const ethereumPriceEur = prices?.ethereum?.eur;
 * const cardanoPriceBtc = prices?.cardano?.btc;
 *
 * // Handle market cap and change data:
 * const bitcoinMarketCap = prices?.bitcoin?.usd_market_cap;
 * const ethereumChange24h = prices?.ethereum?.usd_24h_change;
 * ```
 *
 * @example
 * ```typescript
 * // Portfolio tracking with multiple currencies
 * const portfolioCoins = ['bitcoin', 'ethereum', 'solana', 'cardano'];
 * const displayCurrencies = ['usd', 'eur', 'gbp'];
 *
 * const { data: portfolioPrices } = useSimplePrice(
 *   portfolioCoins,
 *   displayCurrencies,
 *   {
 *     includeMarketCap: true,
 *     include24hrChange: true,
 *   }
 * );
 *
 * // Calculate portfolio value:
 * const calculatePortfolioValue = (holdings: Record<string, number>) => {
 *   return portfolioCoins.reduce((total, coin) => {
 *     const price = portfolioPrices?.[coin]?.usd || 0;
 *     const amount = holdings[coin] || 0;
 *     return total + (price * amount);
 *   }, 0);
 * };
 * ```
 */
export function useSimplePrice(
  ids: string[],
  vsCurrencies: string[],
  options?: SimplePriceOptions,
  queryOptions?: ExtendedQueryOptions<SimplePriceData> & CoinGeckoHookOptions,
): UseQueryResult<SimplePriceData, ApiError> {
  const {
    includeMarketCap,
    include24hrVol,
    include24hrChange,
    includeLastUpdatedAt,
    precision,
  } = options || {};

  // Build query parameters with proper boolean handling
  const queryParams = new URLSearchParams({
    ids: ids.join(","),
    vs_currencies: vsCurrencies.join(","),
  });

  if (includeMarketCap) queryParams.set("include_market_cap", "true");
  if (include24hrVol) queryParams.set("include_24hr_vol", "true");
  if (include24hrChange) queryParams.set("include_24hr_change", "true");
  if (includeLastUpdatedAt) queryParams.set("include_last_updated_at", "true");
  if (precision) queryParams.set("precision", precision);

  return useApiQuery<SimplePriceData>(
    coinGeckoQueryKeys.simple.price(ids, vsCurrencies, options),
    `/api/coingecko/simple/price?${queryParams}`,
    {
      enabled: ids.length > 0 && vsCurrencies.length > 0,
      staleTime: 30 * 1000, // 30 seconds - prices change frequently
      gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache briefly
      ...queryOptions,
    },
  );
}

/**
 * Fetches the complete list of supported currencies for CoinGecko price queries
 *
 * Returns all available target currencies that can be used in vs_currencies parameters
 * for price conversion. This includes fiat currencies (USD, EUR, GBP), major cryptocurrencies
 * (BTC, ETH), and various commodities and other assets supported by CoinGecko.
 *
 * The data is cached for 24 hours as the list of supported currencies rarely changes,
 * making this an efficient way to validate currency inputs and build currency selectors.
 *
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result with array of supported currency symbols
 *
 * @example
 * ```typescript
 * // Get all supported currencies for validation
 * const { data: currencies, isLoading } = useSupportedVsCurrencies({
 *   staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
 *   gcTime: 7 * 24 * 60 * 60 * 1000, // Keep in cache for 7 days
 * });
 *
 * // Use for input validation:
 * const validateCurrency = (currency: string) => {
 *   return currencies?.includes(currency.toLowerCase()) ?? false;
 * };
 *
 * // Filter to major currencies for UI:
 * const majorCurrencies = currencies?.filter(currency =>
 *   ['usd', 'eur', 'gbp', 'jpy', 'btc', 'eth'].includes(currency)
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Build currency selector component
 * const { data: allCurrencies } = useSupportedVsCurrencies();
 *
 * const CurrencySelector = ({ onChange, value }: CurrencySelectorProps) => {
 *   // Group currencies by type
 *   const fiatCurrencies = allCurrencies?.filter(c =>
 *     ['usd', 'eur', 'gbp', 'jpy', 'cad', 'aud'].includes(c)
 *   );
 *   const cryptoCurrencies = allCurrencies?.filter(c =>
 *     ['btc', 'eth', 'bnb', 'ada', 'sol', 'dot'].includes(c)
 *   );
 *
 *   return (
 *     <select value={value} onChange={(e) => onChange(e.target.value)}>
 *       <optgroup label="Fiat Currencies">
 *         {fiatCurrencies?.map(currency => (
 *           <option key={currency} value={currency}>
 *             {currency.toUpperCase()}
 *           </option>
 *         ))}
 *       </optgroup>
 *       <optgroup label="Cryptocurrencies">
 *         {cryptoCurrencies?.map(currency => (
 *           <option key={currency} value={currency}>
 *             {currency.toUpperCase()}
 *           </option>
 *         ))}
 *       </optgroup>
 *     </select>
 *   );
 * };
 * ```
 */
export function useSupportedVsCurrencies(
  options?: ExtendedQueryOptions<string[]> & CoinGeckoHookOptions,
): UseQueryResult<string[], ApiError> {
  return useApiQuery<string[]>(
    coinGeckoQueryKeys.simple.supportedCurrencies(),
    "/api/coingecko/simple/supported-vs-currencies",
    {
      staleTime: 24 * 60 * 60 * 1000, // 24 hours - currencies don't change often
      gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days - keep in cache longer
      ...options,
    },
  );
}

/**
 * Fetches current price data for tokens by their contract addresses on specific blockchain networks
 *
 * This hook enables price lookups for any ERC-20 token or equivalent on supported blockchain networks
 * using contract addresses instead of CoinGecko coin IDs. Essential for DeFi applications, DEX interfaces,
 * and any application dealing with tokens that may not have established CoinGecko listings.
 *
 * Supports all major blockchain networks including Ethereum, Polygon, Binance Smart Chain, Avalanche,
 * and many others. The hook automatically handles network-specific contract address formatting and
 * provides the same market data options as the main price endpoint.
 *
 * @param network - Blockchain network identifier (e.g., 'ethereum', 'polygon-pos', 'binance-smart-chain')
 * @param contractAddresses - Array of contract addresses to fetch prices for
 * @param vsCurrencies - Array of target currencies for price conversion (e.g., ['usd', 'eur', 'btc'])
 * @param options - Configuration options for additional market data and price formatting
 * @param options.includeMarketCap - Include market capitalization data for each token
 * @param options.include24hrVol - Include 24-hour trading volume data
 * @param options.include24hrChange - Include 24-hour percentage change data
 * @param options.includeLastUpdatedAt - Include timestamp of last price update
 * @param options.precision - Control decimal precision of returned prices
 * @param queryOptions - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result with price data indexed by contract address
 *
 * @example
 * ```typescript
 * // Fetch prices for specific ERC-20 tokens on Ethereum
 * const { data: tokenPrices, isLoading } = useTokenPrice(
 *   'ethereum',
 *   [
 *     '0xA0b86a33E6441d0C3F0dD3a4D1dE8Ff5e0B8dE8A', // Example USDC contract
 *     '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', // Example SUSHI contract
 *   ],
 *   ['usd', 'eth'],
 *   {
 *     includeMarketCap: true,
 *     include24hrChange: true,
 *   },
 *   {
 *     refetchInterval: 60000, // Refetch every minute
 *     staleTime: 30000, // 30 second stale time
 *   }
 * );
 *
 * // Access token prices by contract address:
 * const usdcPrice = tokenPrices?.['0xa0b86a33e6441d0c3f0dd3a4d1de8ff5e0b8de8a']?.usd;
 * const sushiPrice = tokenPrices?.['0x6b3595068778dd592e39a122f4f5a5cf09c90fe2']?.usd;
 * ```
 *
 * @example
 * ```typescript
 * // Multi-chain token price tracking
 * const ethereumTokens = ['0x...', '0x...'];
 * const polygonTokens = ['0x...', '0x...'];
 *
 * const { data: ethPrices } = useTokenPrice('ethereum', ethereumTokens, ['usd']);
 * const { data: polygonPrices } = useTokenPrice('polygon-pos', polygonTokens, ['usd']);
 *
 * // Combine prices for portfolio calculation
 * const totalValue = [
 *   ...Object.values(ethPrices || {}),
 *   ...Object.values(polygonPrices || {})
 * ].reduce((sum, tokenData) => sum + (tokenData?.usd || 0), 0);
 * ```
 *
 * @example
 * ```typescript
 * // DEX interface price display
 * const DexTokenPrice = ({ contractAddress, network }: TokenPriceProps) => {
 *   const { data: tokenPrice, isLoading } = useTokenPrice(
 *     network,
 *     [contractAddress],
 *     ['usd', 'eth'],
 *     {
 *       include24hrChange: true,
 *       precision: '6'
 *     }
 *   );
 *
 *   const price = tokenPrice?.[contractAddress.toLowerCase()];
 *   const priceChange = price?.usd_24h_change || 0;
 *   const isPositive = priceChange > 0;
 *
 *   if (isLoading) return <div>Loading price...</div>;
 *
 *   return (
 *     <div className="token-price">
 *       <div className="price">${price?.usd?.toFixed(6)}</div>
 *       <div className={`change ${isPositive ? 'positive' : 'negative'}`}>
 *         {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
 *       </div>
 *     </div>
 *   );
 * };
 * ```
 */
export function useTokenPrice(
  network: string,
  contractAddresses: string[],
  vsCurrencies: string[],
  options?: SimplePriceOptions,
  queryOptions?: ExtendedQueryOptions<SimplePriceData> & CoinGeckoHookOptions,
): UseQueryResult<SimplePriceData, ApiError> {
  const {
    includeMarketCap,
    include24hrVol,
    include24hrChange,
    includeLastUpdatedAt,
    precision,
  } = options || {};

  // Build query parameters with proper boolean handling
  const queryParams = new URLSearchParams({
    contract_addresses: contractAddresses.join(","),
    vs_currencies: vsCurrencies.join(","),
  });

  if (includeMarketCap) queryParams.set("include_market_cap", "true");
  if (include24hrVol) queryParams.set("include_24hr_vol", "true");
  if (include24hrChange) queryParams.set("include_24hr_change", "true");
  if (includeLastUpdatedAt) queryParams.set("include_last_updated_at", "true");
  if (precision) queryParams.set("precision", precision);

  return useApiQuery<SimplePriceData>(
    coinGeckoQueryKeys.simple.tokenPrice(
      network,
      contractAddresses,
      vsCurrencies,
      options,
    ),
    `/api/coingecko/simple/token-price/${network}?${queryParams}`,
    {
      enabled:
        Boolean(network?.trim()) &&
        contractAddresses.length > 0 &&
        vsCurrencies.length > 0,
      staleTime: 30 * 1000, // 30 seconds - token prices change frequently
      gcTime: 5 * 60 * 1000, // 5 minutes
      ...queryOptions,
    },
  );
}
