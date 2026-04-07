/**
 * Neynar API hooks helper utilities
 *
 * Simplified, single-function approach for consistent query parameter handling
 * across all Neynar hooks. Eliminates complexity and spread type errors.
 */

/**
 * Query parameter builder options for Neynar API hooks
 */
interface NeynarQueryOptions {
  cursor?: unknown;
  limit?: number;
}

/**
 * Universal query parameter builder for all Neynar API hooks
 *
 * Clean, single-function approach that handles all query parameter construction:
 * - Base parameters (always required like fid, hash, etc.)
 * - Optional cursor-based pagination
 * - Additional optional parameters from hook options
 * - Proper type conversion and null/undefined filtering
 *
 * @param baseParams - Required parameters specific to the endpoint
 * @param options - Optional configuration including cursor, limit, and additional params
 * @returns URLSearchParams ready for URL construction
 *
 * @example
 * ```typescript
 * // Paginated queries with automatic type conversion
 * const queryParams = buildNeynarQuery(
 *   { fid, ...params }, // fid as number, automatically converted
 *   { cursor, limit: 25 }
 * );
 *
 * // Array queries with automatic joining
 * const queryParams = buildNeynarQuery(
 *   { fids: [123, 456, 789], ...params } // Array automatically joined as "123,456,789"
 * );
 *
 * // Simple queries with no additional params
 * const queryParams = buildNeynarQuery({ identifier: hash });
 * ```
 */
export function buildNeynarQuery(
  allParams: Record<string, unknown>,
  options?: NeynarQueryOptions,
): URLSearchParams {
  const { cursor, limit } = options || {};

  // Add pagination if specified
  const finalParams = { ...allParams };
  if (limit !== undefined) {
    finalParams.limit = limit.toString();
  }
  if (cursor) {
    finalParams.cursor = String(cursor);
  }

  // Convert to URLSearchParams with proper type handling
  const searchParams = new URLSearchParams();
  Object.entries(finalParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        // Handle arrays of numbers or strings
        const arrayValue = value
          .map((item) =>
            typeof item === "number" ? item.toString() : String(item),
          )
          .join(",");
        searchParams.set(key, arrayValue);
      } else if (typeof value === "number") {
        // Convert numbers to strings
        searchParams.set(key, value.toString());
      } else {
        searchParams.set(key, String(value));
      }
    }
  });

  return searchParams;
}
