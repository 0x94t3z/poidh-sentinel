/**
 * Neynar Mutes API Hooks
 *
 * React Query hooks for Neynar mute-related operations.
 * Uses TanStack Query v5 with proper error handling and type safety.
 * Provides functionality for managing user mutes and retrieving mute lists.
 */

import {
  useApiMutation,
  useApiQueryClient,
  useApiInfiniteQuery,
  STALE_TIME,
  type ExtendedMutationOptions,
  type InfiniteQueryHookOptions,
  type MutationHookResult,
} from "../../../private/api-hooks";
import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import type { ApiError } from "../../../private/api-hooks/types";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type {
  MuteListResponse,
  MuteRecord,
  MuteReqBody,
  MuteResponse,
} from "../sdk-response-types";

// ============================================================================
// Mute Query Hooks
// ============================================================================

/**
 * Parameters for {@link useMuteList}
 */
type UseMuteListParams = {
  /**
   * The user's FID (identifier)
   */
  fid: number;

  /**
   * Enables experimental features including filtering based on the Neynar score
   *
   * Sent as global header. See [docs](https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a) for more details.
   */
  x_neynar_experimental?: boolean;

  /**
   * Number of results to fetch
   *
   * - Default: 20
   * - Maximum: 100
   */
  limit?: number;
};

/**
 * Fetches all FIDs that a user has muted
 *
 * @param params - Query parameters (see {@link UseMuteListParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated mute data
 *
 * @example Basic usage
 * ```tsx
 * function MutedUsersList({ fid }: { fid: number }) {
 *   const { data: mutes, fetchNextPage, hasNextPage } = useMuteList({ fid });
 *   return (
 *     <div>
 *       {mutes?.map(muteRecord => (
 *         <div key={muteRecord.muted.fid}>{muteRecord.muted.display_name}</div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useMuteUser} for muting users
 * @see {@link useUnmuteUser} for unmuting users
 */
export function useMuteList(
  params: UseMuteListParams,
  options?: InfiniteQueryHookOptions<MuteListResponse, MuteRecord[]>,
): UseInfiniteQueryResult<MuteRecord[], ApiError> {
  return useApiInfiniteQuery<MuteListResponse, MuteRecord[]>(
    neynarQueryKeys.mutes.list(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        { ...params },
        { cursor, limit: params.limit ?? 20 },
      );
      return `/api/neynar/mutes?${queryParams}`;
    },
    {
      enabled: params.fid > 0,
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (data) =>
        data.pages.flatMap((page: MuteListResponse) => page.mutes || []),
    },
  );
}

// ============================================================================
// Mute Mutation Hooks
// ============================================================================

/**
 * Adds a mute for a given FID
 *
 * **IMPORTANT**: This is an allowlisted API. Reach out to Neynar if you need access.
 *
 * When a user is muted, their posts will no longer appear in the muting user's feeds
 * and notifications. Automatically invalidates mute lists, feeds, and user queries to update UI.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link MuteReqBody}`) => void` - Trigger mute action
 *
 * **Mutation Parameters** (passed to `mutate()`):
 * - `fid: number` - The unique identifier of a farcaster user or app (unsigned integer)
 * - `muted_fid: number` - The unique identifier of a farcaster user or app (unsigned integer)
 *
 * @example Basic usage
 * ```tsx
 * function MuteButton({ targetFid, fid }: { targetFid: number; fid: number }) {
 *   const muteMutation = useMuteUser({
 *     onSuccess: (data) => {
 *       console.log('Successfully muted user!', data);
 *     },
 *     onError: (error) => {
 *       console.error('Failed to mute user:', error);
 *     }
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => muteMutation.mutate({ fid, muted_fid: targetFid })}
 *       disabled={muteMutation.isPending}
 *     >
 *       {muteMutation.isPending ? 'Muting...' : 'Mute User'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useUnmuteUser} for unmuting users
 * @see {@link useMuteList} for viewing muted users
 */
export function useMuteUser(
  options?: ExtendedMutationOptions<MuteResponse, MuteReqBody>,
): MutationHookResult<MuteResponse, MuteReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<MuteResponse, MuteReqBody>(
    "/api/neynar/mutes",
    "POST",
    {
      onSuccess: (_data, _variables) => {
        // Invalidate mute list for the user who performed the mute
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.mutes.all(),
        });
        // Invalidate feeds to remove muted user's content
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.feeds.all(),
        });
        // Invalidate user queries to update relationship status
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * Deletes a mute for a given FID
 *
 * **IMPORTANT**: This is an allowlisted API. Reach out to Neynar if you need access.
 *
 * When a user is unmuted, their posts will start appearing again in the unmuting
 * user's feeds and notifications. Automatically invalidates mute lists, feeds,
 * and user queries to update UI.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link MuteReqBody}`) => void` - Trigger unmute action
 *
 * **Mutation Parameters** (passed to `mutate()`):
 * - `fid: number` - The unique identifier of a farcaster user or app (unsigned integer)
 * - `muted_fid: number` - The unique identifier of a farcaster user or app (unsigned integer)
 *
 * @example Basic usage
 * ```tsx
 * function UnmuteButton({ targetFid, fid }: { targetFid: number; fid: number }) {
 *   const unmuteMutation = useUnmuteUser({
 *     onSuccess: (data) => {
 *       console.log('Successfully unmuted user!', data);
 *     },
 *     onError: (error) => {
 *       console.error('Failed to unmute user:', error);
 *     }
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => unmuteMutation.mutate({ fid, muted_fid: targetFid })}
 *       disabled={unmuteMutation.isPending}
 *     >
 *       {unmuteMutation.isPending ? 'Unmuting...' : 'Unmute User'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useMuteUser} for muting users
 * @see {@link useMuteList} for viewing muted users
 */
export function useUnmuteUser(
  options?: ExtendedMutationOptions<MuteResponse, MuteReqBody>,
): MutationHookResult<MuteResponse, MuteReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<MuteResponse, MuteReqBody>(
    "/api/neynar/mutes",
    "DELETE",
    {
      onSuccess: (_data, _variables) => {
        // Invalidate mute list for the user who performed the unmute
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.mutes.all(),
        });
        // Invalidate feeds to show unmuted user's content again
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.feeds.all(),
        });
        // Invalidate user queries to update relationship status
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.all(),
        });
      },
      ...options,
    },
  );
}
