/**
 * CoinGecko Exchange Rates API Hooks
 *
 * Comprehensive hooks for Bitcoin exchange rates data including:
 * - BTC exchange rates against various fiat and cryptocurrency currencies
 * - Real-time conversion rates for financial calculations
 * - Multi-currency support for international applications
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
// Exchange Rates Types
// ============================================================================

/**
 * Individual exchange rate entry structure
 */
type ExchangeRateEntry = {
  name: string;
  unit: string;
  value: number;
  type: "fiat" | "crypto";
};

/**
 * BTC exchange rates response structure from CoinGecko API
 *
 * Contains exchange rates for Bitcoin against multiple fiat currencies
 * and cryptocurrencies with normalized value representation.
 */
type ExchangeRatesResponse = {
  rates: Record<string, ExchangeRateEntry>;
};

// ============================================================================
// Exchange Rates Hooks
// ============================================================================

/**
 * Get Bitcoin exchange rates against multiple fiat and cryptocurrency currencies
 *
 * This hook fetches real-time BTC exchange rates from CoinGecko API, providing
 * conversion rates for financial calculations, price displays, and multi-currency support.
 * The data includes both fiat currencies (USD, EUR, JPY) and cryptocurrencies (ETH, LTC).
 *
 * @param options - TanStack Query options for caching and refetching behavior
 *
 * @returns TanStack Query result containing BTC exchange rates with currency metadata
 *
 * @example
 * ```typescript
 * function CurrencyConverter() {
 *   const { data, isLoading, error } = useExchangeRates({
 *     staleTime: 60 * 1000, // 1 minute cache
 *     refetchInterval: 30 * 1000 // Auto-refresh every 30 seconds
 *   });
 *
 *   if (isLoading) return <div>Loading exchange rates...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const rates = data?.data?.rates;
 *   if (!rates) return <div>No rates available</div>;
 *
 *   return (
 *     <div>
 *       <h2>Bitcoin Exchange Rates</h2>
 *       <div>
 *         <h3>Fiat Currencies</h3>
 *         {Object.entries(rates)
 *           .filter(([_, rate]) => rate.type === 'fiat')
 *           .map(([currency, rate]) => (
 *             <div key={currency}>
 *               <strong>{rate.name} ({currency.toUpperCase()})</strong>:
 *               {rate.value.toLocaleString()} {rate.unit}
 *             </div>
 *           ))}
 *       </div>
 *       <div>
 *         <h3>Cryptocurrencies</h3>
 *         {Object.entries(rates)
 *           .filter(([_, rate]) => rate.type === 'crypto')
 *           .map(([currency, rate]) => (
 *             <div key={currency}>
 *               <strong>{rate.name} ({currency.toUpperCase()})</strong>:
 *               {rate.value} {rate.unit}
 *             </div>
 *           ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using exchange rates for price conversion
 * function BTCPriceConverter({ btcAmount }: { btcAmount: number }) {
 *   const { data } = useExchangeRates({
 *     staleTime: 2 * 60 * 1000 // 2 minutes
 *   });
 *
 *   const rates = data?.data?.rates;
 *   if (!rates) return <div>Loading rates...</div>;
 *
 *   const usdRate = rates.usd?.value || 0;
 *   const eurRate = rates.eur?.value || 0;
 *
 *   return (
 *     <div>
 *       <p>{btcAmount} BTC = ${(btcAmount * usdRate).toLocaleString()}</p>
 *       <p>{btcAmount} BTC = €{(btcAmount * eurRate).toLocaleString()}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useExchangeRates(
  options?: ExtendedQueryOptions<ExchangeRatesResponse> & CoinGeckoHookOptions,
): UseQueryResult<ExchangeRatesResponse, ApiError> {
  return useApiQuery<ExchangeRatesResponse>(
    coinGeckoQueryKeys.exchangeRates.btc(),
    "/api/coingecko/exchange-rates",
    {
      staleTime: 60 * 1000, // 1 minute - exchange rates change frequently
      gcTime: 5 * 60 * 1000, // 5 minutes
      ...options,
    },
  );
}
