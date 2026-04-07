/**
 * Shared type definitions for API hooks
 * Based on the normalized response structure from api-handlers
 */

import type {
  UseQueryOptions,
  UseMutationOptions,
  UseInfiniteQueryOptions,
  UseQueryResult,
  UseMutationResult,
  UseInfiniteQueryResult,
  InfiniteData,
} from "@tanstack/react-query";

/**
 * Normalized API response structure
 * All API handlers return responses in this format
 */
export type ApiResponse<T = unknown> = {
  data: T;
  pagination?: {
    cursor?: string | null;
    hasMore?: boolean;
    offset?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
};

/**
 * Normalized API error structure
 * All API handlers return errors in this format
 */
export type ApiError = {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
};

/**
 * Query key factory type for hierarchical cache management
 */
export type QueryKeyFactory = {
  all: () => readonly string[];
  lists: () => readonly string[];
  list: (filters?: Record<string, unknown>) => readonly unknown[];
  details: () => readonly string[];
  detail: (id: string | number, ...args: unknown[]) => readonly unknown[];
};

/**
 * Scoped query key factory type for specific endpoints
 */
export type ScopedQueryKeyFactory = {
  all: () => readonly string[];
  lists: () => readonly string[];
  list: (filters?: Record<string, unknown>) => readonly unknown[];
  details: () => readonly string[];
  detail: (id: string | number, ...args: unknown[]) => readonly unknown[];
  custom: (type: string, ...args: unknown[]) => readonly unknown[];
};

/**
 * Base options for query hooks
 */
export type BaseQueryOptions = {
  requestOptions?: RequestInit;
};

/**
 * Base options for mutation hooks
 */
export type BaseMutationOptions = {
  requestOptions?: RequestInit;
};

/**
 * Base options for infinite query hooks
 */
export type BaseInfiniteQueryOptions = {
  requestOptions?: RequestInit;
};

/**
 * Extended query options combining base options with TanStack Query options
 *
 * @template TQueryFnData - The type returned by the query function (raw SDK response)
 * @template TData - The final type after select transformation (defaults to TQueryFnData)
 */
export type ExtendedQueryOptions<
  TQueryFnData = unknown,
  TData = TQueryFnData,
> = BaseQueryOptions &
  Omit<UseQueryOptions<TQueryFnData, ApiError, TData>, "queryKey" | "queryFn">;

/**
 * Query options for hooks (with select omitted since hooks provide their own select)
 *
 * @template TQueryFnData - The type returned by the query function (raw SDK response)
 * @template TData - The final type after select transformation (defaults to TQueryFnData)
 */
export type QueryHookOptions<
  TQueryFnData = unknown,
  TData = TQueryFnData,
> = Omit<ExtendedQueryOptions<TQueryFnData, TData>, "select">;

/**
 * Extended mutation options combining base options with TanStack Query options
 */
export type ExtendedMutationOptions<
  TData = unknown,
  TVariables = unknown,
> = BaseMutationOptions &
  Omit<UseMutationOptions<TData, ApiError, TVariables>, "mutationFn">;

/**
 * Extended infinite query options combining base options with TanStack Query options
 *
 * @template TQueryFnData - The type returned by the query function (raw SDK response)
 * @template TData - The final type after select transformation (defaults to structured page with TQueryFnData items)
 */
export type ExtendedInfiniteQueryOptions<
  TQueryFnData = unknown,
  TData = InfiniteQueryPage<TQueryFnData>,
> = BaseInfiniteQueryOptions &
  Omit<
    UseInfiniteQueryOptions<TQueryFnData, ApiError, TData>,
    "queryKey" | "queryFn" | "getNextPageParam" | "initialPageParam"
  >;

/**
 * Infinite query options for hooks (with select omitted since hooks provide their own select)
 *
 * Simplified to only require the item type T - automatically wraps in InfiniteDataPage<T>
 *
 * @template TQueryFnData - The type returned by the query function (raw SDK response)
 * @template T - The item type (e.g., User, Cast) - will be wrapped in InfiniteDataPage<T>
 */
export type InfiniteQueryHookOptions<
  TQueryFnData = unknown,
  T = unknown,
> = Omit<
  ExtendedInfiniteQueryOptions<TQueryFnData, InfiniteDataPage<T>>,
  "select"
>;

/**
 * Infinite query page structure
 */
export type InfiniteQueryPage<T = unknown> = {
  items: T[];
  nextCursor?: string | null;
  hasNextPage: boolean;
};

/**
 * Infinite data page structure - convenience type for InfiniteData<InfiniteQueryPage<T>>
 * Use this for the second generic of useApiInfiniteQuery
 */
export type InfiniteDataPage<T = unknown> = InfiniteData<InfiniteQueryPage<T>>;

/**
 * Hook result types for consistency
 */
export type QueryHookResult<T> = UseQueryResult<T, ApiError>;
export type MutationHookResult<TData, TVariables> = UseMutationResult<
  TData,
  ApiError,
  TVariables,
  unknown
>;
export type InfiniteQueryHookResult<T> = UseInfiniteQueryResult<
  InfiniteDataPage<T>,
  ApiError
>;
