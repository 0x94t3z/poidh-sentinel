/**
 * Neynar Bans API hooks
 *
 * Comprehensive set of hooks for managing user bans and ban lists.
 * Each hook uses hierarchical query keys and follows Neynar API patterns.
 */

import {
  useApiMutation,
  useApiQueryClient,
  useApiInfiniteQuery,
  STALE_TIME,
  type ExtendedMutationOptions,
  type InfiniteQueryHookOptions,
} from "../../../private/api-hooks";
import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import type { ApiError } from "../../../private/api-hooks/types";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type {
  BanRecord,
  BanResponse,
  BanListResponse,
} from "../sdk-response-types";

/**
 * Parameters for fetching ban list
 */
export type UseBanListParams = {
  /**
   * Number of results to fetch per page
   *
   * Controls pagination size for banned user list.
   *
   * **Constraints:**
   * - Default: 20
   * - Maximum: 100
   * - Minimum: 1
   */
  limit?: number;

  /**
   * Enables experimental features including filtering based on the Neynar score
   *
   * When enabled, provides access to experimental Neynar features including spam score filtering.
   * Sent as global header (`x-neynar-experimental`).
   *
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a | Experimental Features Documentation}
   */
  x_neynar_experimental?: boolean;
};

/**
 * Parameters for banning users
 */
export type PublishBansParams = {
  /**
   * Array of Farcaster IDs (FIDs) to ban
   *
   * List of user FIDs to ban from your app. Banned users, their casts,
   * and reactions will not appear in your app's feeds.
   */
  fids: number[];
};

/**
 * Parameters for unbanning users
 */
export type DeleteBansParams = {
  /**
   * Array of Farcaster IDs (FIDs) to unban
   *
   * List of user FIDs to remove ban from. Unbanned users, their casts,
   * and reactions will once again appear in your app's feeds.
   */
  fids: number[];
};

/**
 * Fetches all FIDs that your app has banned
 *
 * @param params - Query parameters for filtering and pagination
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated ban records
 *
 * @example Basic ban list
 * ```tsx
 * function BanList() {
 *   const { data, fetchNextPage, hasNextPage } = useBanList({ limit: 50 });
 *   const bans = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {bans.map(ban => (
 *         <div key={ban.banned.fid}>
 *           {ban.banned.display_name} (@{ban.banned.username})
 *         </div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link usePublishBans} for banning users
 * @see {@link useDeleteBans} for unbanning users
 */
export function useBanList(
  params?: UseBanListParams,
  options?: InfiniteQueryHookOptions<BanListResponse, BanRecord[]>,
): UseInfiniteQueryResult<BanRecord[], ApiError> {
  return useApiInfiniteQuery<BanListResponse, BanRecord[]>(
    neynarQueryKeys.bans.list(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        { ...params },
        { cursor, limit: params?.limit || 20 }, // SDK default: 20, max: 100
      );
      return `/api/neynar/bans?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (data) =>
        data.pages.flatMap((page: BanListResponse) => page.bans || []),
    },
  );
}

/**
 * Bans a list of FIDs from the app associated with your API key
 *
 * Banned users, their casts and reactions will not appear in feeds.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link PublishBansParams}`) => void` - Trigger ban operation
 *
 * @example Basic usage
 * ```tsx
 * function BanButton({ fid }: { fid: number }) {
 *   const banMutation = usePublishBans({
 *     onSuccess: () => console.log('User banned')
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => banMutation.mutate({ fids: [fid] })}
 *       disabled={banMutation.isPending}
 *     >
 *       {banMutation.isPending ? 'Banning...' : 'Ban User'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useDeleteBans} for unbanning users
 * @see {@link useBanList} for fetching ban list
 */
export function usePublishBans(
  options?: ExtendedMutationOptions<BanResponse, PublishBansParams>,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<BanResponse, PublishBansParams>(
    "/api/neynar/bans",
    "POST",
    {
      onSuccess: (_data, _variables) => {
        // Invalidate ban list to reflect new bans
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.bans.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * Deletes a list of FIDs from the app associated with your API key
 *
 * Unbanned users, their casts and reactions will once again appear in feeds.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link DeleteBansParams}`) => void` - Trigger unban operation
 *
 * @example Basic usage
 * ```tsx
 * function UnbanButton({ fid }: { fid: number }) {
 *   const unbanMutation = useDeleteBans({
 *     onSuccess: () => console.log('User unbanned')
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => unbanMutation.mutate({ fids: [fid] })}
 *       disabled={unbanMutation.isPending}
 *     >
 *       {unbanMutation.isPending ? 'Unbanning...' : 'Unban User'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link usePublishBans} for banning users
 * @see {@link useBanList} for fetching ban list
 */
export function useDeleteBans(
  options?: ExtendedMutationOptions<BanResponse, DeleteBansParams>,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<BanResponse, DeleteBansParams>(
    "/api/neynar/bans",
    "DELETE",
    {
      onSuccess: (_data, _variables) => {
        // Invalidate ban list to reflect removed bans
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.bans.all(),
        });
      },
      ...options,
    },
  );
}
