/**
 * Base hook utilities for the Neynar Web SDK API architecture
 * Provides consistent patterns for queries, mutations, and infinite queries
 *
 * ARCHITECTURE DECISION: Raw SDK responses flow through these hooks unchanged.
 * Hooks use React Query's select() option to extract what they need from raw responses.
 *
 * This ensures:
 * - Zero data loss (no lossy backend normalization)
 * - Type safety (hooks know exact SDK response structure)
 * - Flexibility (different hooks can extract differently)
 * - Future-proof (SDK changes handled per-hook, not globally)
 */

import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type {
  ApiError,
  ExtendedQueryOptions,
  ExtendedMutationOptions,
  ExtendedInfiniteQueryOptions,
  QueryHookResult,
  MutationHookResult,
} from "./types";

/**
 * Enhanced fetch function with proper error handling for normalized API responses
 *
 * Handles the standardized response format from our API handlers and provides
 * consistent error parsing across all endpoints.
 *
 * @template T - The expected response data type
 * @param url - The API endpoint URL to request
 * @param options - Standard fetch RequestInit options
 * @returns Promise that resolves to the typed response data
 * @throws {ApiError} Standardized error object with status, message, code, and details
 */
async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const responseData = await response.json();

  if (!response.ok) {
    // Handle error response - normalized by api-handlers
    const error: ApiError = responseData.error || {
      status: response.status,
      message: response.statusText || "An error occurred",
    };
    throw error;
  }

  // Success response - return raw SDK response unchanged
  // Hooks will use select() to extract what they need
  return responseData;
}

/**
 * Universal API query hook with support for raw SDK responses
 *
 * This is the foundation hook that all specific API hooks build upon.
 * It returns raw SDK responses and relies on the select option for data extraction.
 *
 * @template T - The expected data type after select() extraction
 * @param queryKey - Hierarchical query key for caching and invalidation
 * @param endpoint - The API endpoint URL
 * @param options - Extended options including select function for data extraction
 * @returns UseQueryResult with typed data, loading states, and error handling
 *
 * @example
 * ```typescript
 * // Fetch user with select() to extract from raw SDK response
 * function useUser(fid: number, options?: ExtendedQueryOptions<User>) {
 *   return useApiQuery<User>(
 *     ['neynar', 'user', 'detail', 'fid', fid],
 *     `/api/neynar/users/bulk?fids=${fid}`,
 *     {
 *       ...options,
 *       select: (response: any) => {
 *         // SDK returns: { result: { users: [User] } }
 *         return response.result?.users?.[0] || null;
 *       }
 *     }
 *   );
 * }
 *
 * // Usage in component - data is extracted by select()
 * const { data: user, isLoading, error } = useUser(123);
 * if (user) {
 *   console.log(user.username); // Direct access to User type
 * }
 * ```
 */
export function useApiQuery<TQueryFnData = unknown, TData = TQueryFnData>(
  queryKey: readonly unknown[],
  endpoint: string,
  options?: ExtendedQueryOptions<TQueryFnData, TData>,
): QueryHookResult<TData> {
  const { requestOptions, ...queryOptions } = options || {};

  return useQuery<TQueryFnData, ApiError, TData>({
    queryKey,
    queryFn: () => apiRequest<TQueryFnData>(endpoint, requestOptions),
    ...queryOptions,
  });
}

/**
 * Universal API mutation hook for data modification operations
 *
 * This hook handles POST, PUT, PATCH, and DELETE operations with the same
 * normalized response handling as queries. Perfect for actions that modify
 * server state and need to trigger cache invalidations.
 *
 * @template TData - The expected response data type
 * @template TVariables - The type of data sent in the mutation
 * @param endpoint - The API endpoint URL
 * @param method - HTTP method for the mutation (defaults to 'POST')
 * @param options - Extended options including request options and TanStack Query mutation options
 * @returns UseMutationResult with mutate function, loading states, and error handling
 *
 * @example
 * ```typescript
 * // Create a mutation for following a user
 * function useFollowUser() {
 *   const queryClient = useQueryClient();
 *   return useApiMutation<
 *     FollowResponse,
 *     { target_fid: number }
 *   >(
 *     '/api/neynar/follows',
 *     'POST',
 *     {
 *       onSuccess: (data, variables) => {
 *         console.log('Follow successful:', data); // Direct access to response data
 *
 *         // Invalidate related queries using hierarchical keys
 *         queryClient.invalidateQueries({
 *           queryKey: ['neynar', 'user', 'followers', variables.target_fid]
 *         });
 *         queryClient.invalidateQueries({
 *           queryKey: ['neynar', 'user', 'following']
 *         });
 *       }
 *     }
 *   );
 * }
 *
 * // Usage in component
 * const followUser = useFollowUser();
 * const handleFollow = () => {
 *   followUser.mutate({ target_fid: 123 });
 * };
 * ```
 */
export function useApiMutation<TData, TVariables = void>(
  endpoint: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
  options?: ExtendedMutationOptions<TData, TVariables>,
): MutationHookResult<TData, TVariables> {
  const { requestOptions, ...mutationOptions } = options || {};

  return useMutation<TData, ApiError, TVariables>({
    mutationFn: (variables: TVariables) =>
      apiRequest<TData>(endpoint, {
        method,
        body: variables ? JSON.stringify(variables) : undefined,
        ...requestOptions,
      }),
    ...mutationOptions,
  });
}

/**
 * Universal API infinite query hook for paginated data following TanStack Query v5 best practices
 *
 * Implements infinite scrolling with cursor-based pagination. The hook returns raw API responses
 * to queryFn, and individual hooks use select() to transform data for consumption.
 *
 * **TanStack Query v5 Requirements:**
 * - `initialPageParam` is required and must be explicit (null for cursor-based pagination)
 * - `getNextPageParam` receives raw API response, NOT select() transformed data
 * - `select()` is optional and transforms accumulated pages for consumption
 *
 * @template TQueryFnData - The raw API response type from queryFn
 * @template TData - The final transformed type after select() (defaults to TQueryFnData)
 * @param queryKey - Hierarchical query key for caching and invalidation
 * @param buildEndpoint - Function that constructs endpoint URL from page parameter (cursor)
 * @param options - Extended query options including select() for data transformation
 * @returns UseInfiniteQueryResult with infinite scroll controls and accumulated pages
 *
 * @example
 * ```typescript
 * // Cursor-based pagination with flattened results
 * const { data: casts } = useApiInfiniteQuery<FeedResponse, Cast[]>(
 *   ['neynar', 'feed', 'following'],
 *   (cursor) => `/api/neynar/feed/following?cursor=${cursor || ''}&limit=25`,
 *   {
 *     select: (data) => data.pages.flatMap(page => page.casts || [])
 *   }
 * );
 * // Returns: Cast[] (flattened array of all casts across all pages)
 *
 * // Access to full infinite query data
 * const feed = useApiInfiniteQuery<FeedResponse>(
 *   ['neynar', 'feed', 'following'],
 *   (cursor) => `/api/neynar/feed/following?cursor=${cursor || ''}&limit=25`
 * );
 * // Returns: { pages: [{ casts: Cast[], next: { cursor: string } }, ...], pageParams: [...] }
 * // Access: feed.data.pages, feed.fetchNextPage(), feed.hasNextPage
 * ```
 */
export function useApiInfiniteQuery<
  TQueryFnData = unknown,
  TData = TQueryFnData,
>(
  queryKey: readonly unknown[],
  buildEndpoint: (pageParam: string | null) => string,
  options?: ExtendedInfiniteQueryOptions<TQueryFnData, TData>,
) {
  const { requestOptions, ...queryOptions } = options || {};

  return useInfiniteQuery<TQueryFnData, ApiError, TData>({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const endpoint = buildEndpoint(pageParam as string | null);
      const response = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
          ...requestOptions?.headers,
        },
        ...requestOptions,
      });

      const responseData = await response.json();

      if (!response.ok) {
        const error: ApiError = responseData.error || {
          status: response.status,
          message: response.statusText || "An error occurred",
        };
        throw error;
      }

      // Return raw API response unchanged
      // getNextPageParam will extract cursor from this raw structure
      return responseData;
    },
    // TanStack Query v5: Required explicit initial page parameter
    // null indicates first page (no cursor) for Neynar's cursor-based pagination
    initialPageParam: null as string | null,
    // TanStack Query v5: Receives RAW API response from queryFn (not select() output)
    // Neynar API response structure: { casts/users/notifications: T[], next?: { cursor?: string } }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getNextPageParam: (lastPage: any) => {
      // Extract cursor from Neynar's standard pagination structure
      // Returns undefined when no more pages (TanStack Query v5 stops pagination)
      const nextCursor = lastPage?.next?.cursor;
      return nextCursor ? (nextCursor as string) : undefined;
    },
    ...queryOptions,
  });
}

/**
 * Hook to access the TanStack Query client for manual cache operations
 *
 * Provides direct access to the QueryClient instance for advanced operations
 * like manual cache invalidation, prefetching data, or setting query data.
 *
 * @returns QueryClient instance for manual query operations
 *
 * @example
 * ```typescript
 * // Manual cache management
 * function useAdvancedCacheOperations() {
 *   const queryClient = useApiQueryClient();
 *
 *   const prefetchUser = (fid: number) => {
 *     queryClient.prefetchQuery({
 *       queryKey: ['neynar', 'user', 'detail', 'fid', fid],
 *       queryFn: () => apiRequest<User>(`/api/neynar/users/user?fid=${fid}`),
 *       staleTime: 5 * 60 * 1000, // 5 minutes
 *     });
 *   };
 *
 *   const invalidateUserQueries = (fid: number) => {
 *     // Invalidate all queries for this specific user
 *     queryClient.invalidateQueries({
 *       queryKey: ['neynar', 'user', 'detail', 'fid', fid]
 *     });
 *   };
 *
 *   return { prefetchUser, invalidateUserQueries };
 * }
 * ```
 */
export function useApiQueryClient(): QueryClient {
  return useQueryClient();
}
