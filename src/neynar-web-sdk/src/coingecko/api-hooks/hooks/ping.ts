/**
 * CoinGecko Ping API Hooks
 *
 * React Query hooks for CoinGecko API connectivity testing.
 * Uses TanStack Query v5 with proper error handling, type safety, and hierarchical caching.
 *
 * This module provides hooks for testing CoinGecko API availability and connection status,
 * essential for health checks and debugging API connectivity issues.
 *
 * @example Basic Usage
 * ```tsx
 * import { usePing } from '@/neynar-web-sdk/api-hooks';
 *
 * function APIHealthCheck() {
 *   const { data, isLoading, error } = usePing();
 *
 *   if (isLoading) return <div>Checking API...</div>;
 *   if (error) return <div>API Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>CoinGecko API Status</h2>
 *       <p>Status: {data?.gecko_says || 'Unknown'}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useApiQuery } from "../../../private/api-hooks";
import { coinGeckoQueryKeys } from "../query-keys";
import type { CoinGeckoHookOptions, PingResponse } from "../types";
import type {
  ExtendedQueryOptions,
  QueryHookResult,
} from "../../../private/api-hooks/types";

// ============================================================================
// System Health Hooks
// ============================================================================

/**
 * Test CoinGecko API connectivity
 *
 * Pings the CoinGecko API to verify service availability and connection status.
 * This endpoint is commonly used for health checks and debugging connectivity issues.
 * Returns a simple message indicating the API is responsive.
 *
 * **API Endpoint:** `GET /ping`
 *
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing ping response data, loading state, and error info
 *
 * @example Basic connectivity test
 * ```tsx
 * function APIHealthIndicator() {
 *   const { data: pingResult, isLoading, error } = usePing();
 *
 *   if (isLoading) return <span>Checking API...</span>;
 *   if (error) return <span className="text-red-500">API Offline</span>;
 *   if (!pingResult) return <span>No response</span>;
 *
 *   return (
 *     <div className="flex items-center gap-2">
 *       <div className="w-2 h-2 bg-green-500 rounded-full" />
 *       <span>API Online: {pingResult.gecko_says}</span>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Automated health monitoring
 * ```tsx
 * function useAPIHealthMonitor() {
 *   const { data, error, refetch } = usePing({
 *     refetchInterval: 30000, // Check every 30 seconds
 *     retry: 3,
 *     staleTime: 0, // Always check fresh
 *   });
 *
 *   return {
 *     isHealthy: !!data?.gecko_says,
 *     hasError: !!error,
 *     lastCheck: data ? new Date() : null,
 *     recheckHealth: refetch,
 *   };
 * }
 * ```
 *
 * @example Error handling with fallback
 * ```tsx
 * function APIStatus() {
 *   const { data, isLoading, error, refetch } = usePing();
 *
 *   const handleRetry = () => {
 *     refetch();
 *   };
 *
 *   if (isLoading) {
 *     return <div>Testing API connection...</div>;
 *   }
 *
 *   if (error) {
 *     return (
 *       <div className="text-red-600">
 *         <p>API connection failed: {error.message}</p>
 *         <button onClick={handleRetry} className="mt-2">
 *           Retry Connection
 *         </button>
 *       </div>
 *     );
 *   }
 *
 *   return (
 *     <div className="text-green-600">
 *       <p>✓ CoinGecko API is responsive</p>
 *       <p className="text-sm">Response: {data?.gecko_says}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link https://docs.coingecko.com/reference/ping | CoinGecko API - Ping Endpoint}
 */
export function usePing(
  options?: ExtendedQueryOptions<PingResponse> & CoinGeckoHookOptions,
): QueryHookResult<PingResponse> {
  return useApiQuery<PingResponse>(
    coinGeckoQueryKeys.ping(),
    "/api/coingecko/ping",
    {
      staleTime: 0, // Don't cache ping results - always test fresh connection
      retry: 2, // Allow retries for network issues
      retryDelay: 1000, // Wait 1s between retries
      ...options,
    },
  );
}
