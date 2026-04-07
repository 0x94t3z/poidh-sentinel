/**
 * CoinGecko Key API Hooks
 *
 * Comprehensive hooks for API key management and usage monitoring:
 * - API key information and current plan details
 * - Usage statistics and call credits
 * - Monthly quota tracking and remaining calls
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { CoinGeckoHookOptions, KeyInfo } from "../types";
import type {
  ExtendedQueryOptions,
  QueryHookResult,
} from "../../../private/api-hooks/types";

// ============================================================================
// API Key Information Hooks
// ============================================================================

/**
 * Fetches comprehensive API key information including plan details and usage statistics
 *
 * This hook provides essential information about your CoinGecko API key including:
 * - Current subscription plan and tier
 * - Monthly call credits and limits
 * - Current usage statistics and remaining calls
 * - Plan-specific features and rate limits
 *
 * Essential for building usage monitoring dashboards, quota management systems,
 * and ensuring API compliance within your application's rate limits.
 *
 * @param options - TanStack Query options for caching and refetching behavior
 * @param options.enabled - Whether the query should execute (default true)
 * @param options.staleTime - Time in milliseconds before data is considered stale
 * @param options.refetchOnWindowFocus - Whether to refetch when window regains focus
 * @param options.refetchInterval - Interval in milliseconds for automatic refetching
 *
 * @returns TanStack Query result with comprehensive API key information
 *
 * @example
 * ```typescript
 * const { data: keyInfo, isLoading, error } = useKeyInfo({
 *   staleTime: 300000, // Cache for 5 minutes
 *   refetchInterval: 300000, // Update every 5 minutes
 * });
 *
 * // Monitor API usage:
 * if (keyInfo) {
 *   const usagePercentage = (keyInfo.current_total_monthly_calls / keyInfo.monthly_call_credit) * 100;
 *   const remainingCalls = keyInfo.current_remaining_monthly_calls;
 *
 *   console.log(`Plan: ${keyInfo.plan}`);
 *   console.log(`Usage: ${usagePercentage.toFixed(1)}%`);
 *   console.log(`Remaining calls: ${remainingCalls}`);
 *
 *   // Implement usage warnings:
 *   if (usagePercentage > 90) {
 *     showWarning('API quota nearly exceeded');
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Integration with rate limiting system:
 * const { data: keyInfo } = useKeyInfo({
 *   refetchInterval: 60000, // Check every minute
 * });
 *
 * const canMakeRequest = keyInfo?.current_remaining_monthly_calls > 0;
 * const shouldThrottle = keyInfo &&
 *   (keyInfo.current_remaining_monthly_calls / keyInfo.monthly_call_credit) < 0.1;
 *
 * if (!canMakeRequest) {
 *   throw new Error('Monthly API quota exceeded');
 * }
 *
 * if (shouldThrottle) {
 *   // Implement request throttling logic
 *   await delay(1000);
 * }
 * ```
 */
export function useKeyInfo(
  options?: ExtendedQueryOptions<KeyInfo> & CoinGeckoHookOptions,
): QueryHookResult<KeyInfo> {
  return useApiQuery<KeyInfo>(
    coinGeckoQueryKeys.key.info(),
    "/api/coingecko/key",
    {
      staleTime: 5 * 60 * 1000, // 5 minutes - usage data changes frequently
      gcTime: 30 * 60 * 1000, // 30 minutes - keep in cache for dashboard usage
      refetchOnWindowFocus: true, // Refresh when user returns to check quota
      ...options,
    },
  );
}
