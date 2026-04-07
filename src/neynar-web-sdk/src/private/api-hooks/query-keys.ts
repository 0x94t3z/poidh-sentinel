/**
 * Hierarchical query key factory utilities
 * Preserves the excellent nested invalidation system from the old api-hooks
 * Following TanStack Query v5 best practices for hierarchical key management
 */

import type { QueryKeyFactory, ScopedQueryKeyFactory } from "./types";

/**
 * Creates a hierarchical query key factory for consistent key management
 * This enables powerful nested cache invalidation patterns
 *
 * @param scope - The API scope (e.g., 'neynar', 'coingecko')
 * @returns Query key factory with hierarchical structure
 *
 * @example
 * ```typescript
 * const neynarKeys = createQueryKeyFactory("neynar");
 *
 * // Invalidate ALL neynar queries
 * queryClient.invalidateQueries({ queryKey: neynarKeys.all() });
 *
 * // Invalidate all list queries
 * queryClient.invalidateQueries({ queryKey: neynarKeys.lists() });
 * ```
 */
export function createQueryKeyFactory(scope: string): QueryKeyFactory {
  return {
    // Top-level scope key - invalidates everything for this API
    all: () => [scope] as const,

    // List queries - invalidates all paginated/collection queries
    lists: () => [scope, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [scope, "list", filters ?? {}] as const,

    // Detail queries - invalidates all single-item queries
    details: () => [scope, "detail"] as const,
    detail: (id: string | number, ...args: unknown[]) =>
      [scope, "detail", id, ...args] as const,
  };
}

/**
 * Creates scoped query keys for specific endpoints
 * Provides fine-grained control over cache invalidation for related queries
 *
 * @param scope - The API scope (e.g., 'neynar', 'coingecko')
 * @param endpoint - The specific endpoint (e.g., 'user', 'cast', 'coin')
 * @returns Scoped query key factory for the endpoint
 *
 * @example
 * ```typescript
 * const userKeys = createScopedQueryKeys("neynar", "user");
 *
 * // Invalidate all user-related queries
 * queryClient.invalidateQueries({ queryKey: userKeys.all() });
 *
 * // Invalidate specific user
 * queryClient.invalidateQueries({ queryKey: userKeys.detail("fid", 123) });
 *
 * // Invalidate user followers
 * queryClient.invalidateQueries({ queryKey: userKeys.custom("followers", 123) });
 * ```
 */
export function createScopedQueryKeys(
  scope: string,
  endpoint: string,
): ScopedQueryKeyFactory {
  return {
    // All queries for this endpoint
    all: () => [scope, endpoint] as const,

    // List queries for this endpoint
    lists: () => [scope, endpoint, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      [scope, endpoint, "list", filters ?? {}] as const,

    // Detail queries for this endpoint
    details: () => [scope, endpoint, "detail"] as const,
    detail: (id: string | number, ...args: unknown[]) =>
      [scope, endpoint, "detail", id, ...args] as const,

    // Custom query types for specialized use cases
    custom: (type: string, ...args: unknown[]) =>
      [scope, endpoint, type, ...args] as const,
  };
}

/**
 * Utility to create invalidation keys by pattern
 * Simplifies the process of invalidating related queries
 *
 * @param scope - The API scope
 * @param endpoint - Optional specific endpoint
 * @param type - Optional specific query type
 * @returns Query key array for invalidation
 *
 * @example
 * ```typescript
 * // Invalidate all neynar queries
 * queryClient.invalidateQueries({ queryKey: getInvalidationKey("neynar") });
 *
 * // Invalidate all user queries
 * queryClient.invalidateQueries({ queryKey: getInvalidationKey("neynar", "user") });
 *
 * // Invalidate all user followers queries
 * queryClient.invalidateQueries({ queryKey: getInvalidationKey("neynar", "user", "followers") });
 * ```
 */
export function getInvalidationKey(
  scope: string,
  endpoint?: string,
  type?: string,
): readonly string[] {
  if (!endpoint) {
    return [scope];
  }
  if (!type) {
    return [scope, endpoint];
  }
  return [scope, endpoint, type];
}

/**
 * Utility to normalize filter parameters for consistent cache keys
 * Ensures that the same filters in different orders produce the same cache key
 *
 * @param filters - The filter object to normalize
 * @returns Normalized filter object with sorted keys and values
 *
 * @example
 * ```typescript
 * // These produce the same cache key
 * normalizeFilters({ fids: [3, 1, 2], includeDetails: true });
 * normalizeFilters({ includeDetails: true, fids: [1, 2, 3] });
 * // Both result in: { fids: "1,2,3", includeDetails: true }
 * ```
 */
export function normalizeFilters(
  filters?: Record<string, unknown>,
): Record<string, unknown> {
  if (!filters) return {};

  const normalized: Record<string, unknown> = {};

  // Sort keys for consistency
  const sortedKeys = Object.keys(filters).sort();

  for (const key of sortedKeys) {
    const value = filters[key];

    // Handle array values - sort and join for consistent string representation
    if (Array.isArray(value)) {
      // Sort numbers numerically, strings lexicographically
      const sorted = [...value].sort((a, b) => {
        if (typeof a === "number" && typeof b === "number") {
          return a - b;
        }
        return String(a).localeCompare(String(b));
      });
      normalized[key] = sorted.join(",");
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}
