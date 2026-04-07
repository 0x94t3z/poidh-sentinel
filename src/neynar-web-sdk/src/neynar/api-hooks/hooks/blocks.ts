/**
 * Neynar Blocks API Hooks
 *
 * React Query hooks for Neynar block-related operations.
 * Uses TanStack Query v5 with proper error handling, type safety, and hierarchical caching.
 *
 * This module provides comprehensive hooks for block management operations,
 * including fetching block lists, blocking users, and unblocking users.
 * All mutations automatically invalidate relevant queries for UI consistency.
 *
 * @example Basic Usage
 * ```tsx
 * import { useBlockList, useBlockUser, useUnblockUser } from '@/neynar-web-sdk/api-hooks';
 *
 * function BlockManagement({ viewerFid, signerUuid }: {
 *   viewerFid: number;
 *   signerUuid: string;
 * }) {
 *   const { data: blockedUsers, isLoading } = useBlockList({ blocker_fid: viewerFid });
 *   const blockMutation = useBlockUser();
 *   const unblockMutation = useUnblockUser();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Blocked Users</h2>
 *       {blockedUsers?.map(block => (
 *         <div key={block.blocked?.fid}>
 *           <span>{block.blocked?.display_name}</span>
 *           <button onClick={() => unblockMutation.mutate({
 *             signer_uuid: signerUuid,
 *             blocked_fid: block.blocked?.fid
 *           })}>
 *             Unblock
 *           </button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
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
  BlockListResponse,
  BlockRecord,
  BlockReqBody,
  OperationResponse,
} from "../sdk-response-types";

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Parameters for fetching block list
 *
 * @see {@link useBlockList}
 */
export type UseBlockListParams = {
  /**
   * Returns users that this user has blocked
   *
   * Provide either `blocker_fid` OR `blocked_fid`, not both.
   */
  blocker_fid?: number;

  /**
   * Returns users that have blocked this user
   *
   * Provide either `blocker_fid` OR `blocked_fid`, not both.
   */
  blocked_fid?: number;

  /**
   * Results per page
   *
   * - Default: 20
   * - Maximum: 100
   */
  limit?: number;

  /**
   * Enables experimental features including filtering based on the Neynar score
   *
   * Sent as global header. See {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a | experimental features docs} for more details.
   */
  x_neynar_experimental?: boolean;
};

/**
 * Fetches all FIDs that a user has blocked or has been blocked by
 *
 * **Special Behaviors:**
 * - Requires either `blocker_fid` OR `blocked_fid` parameter (validated before query)
 * - Results automatically flattened from pages for easier consumption
 *
 * @param params - Block list query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated block data
 *
 * @example
 * ```tsx
 * function BlockedUsersList({ userFid }: { userFid: number }) {
 *   const { data: blockRecords, fetchNextPage, hasNextPage } = useBlockList({
 *     blocker_fid: userFid,
 *     limit: 20
 *   });
 *
 *   return (
 *     <div>
 *       {blockRecords?.map(block => (
 *         <div key={block.blocked?.fid}>{block.blocked?.display_name}</div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useBlockUser} for blocking a user
 * @see {@link useUnblockUser} for unblocking a user
 */
export function useBlockList(
  params: UseBlockListParams,
  options?: InfiniteQueryHookOptions<BlockListResponse, BlockRecord[]>,
): UseInfiniteQueryResult<BlockRecord[], ApiError> {
  // Validate that at least one required parameter is provided
  if (!params.blocker_fid && !params.blocked_fid) {
    throw new Error(
      "useBlockList requires either blocker_fid or blocked_fid parameter",
    );
  }

  return useApiInfiniteQuery<BlockListResponse, BlockRecord[]>(
    neynarQueryKeys.blocks.list(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          blocker_fid: params.blocker_fid,
          blocked_fid: params.blocked_fid,
          limit: params.limit ?? 20, // SDK Default: 20, Maximum: 100
          x_neynar_experimental: params.x_neynar_experimental,
        },
        { cursor },
      );
      return `/api/neynar/blocks?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (data) =>
        data.pages.flatMap((page: BlockListResponse) => page.blocks || []),
    },
  );
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Parameters for blocking a user
 *
 * @see {@link useBlockUser}
 */
export type UseBlockUserParams = {
  /**
   * UUID of the signer
   *
   * `signer_uuid` is paired with API key, can't use a `uuid` made with a different API key.
   */
  signer_uuid: string;

  /**
   * The unique identifier of a farcaster user or app (unsigned integer)
   */
  blocked_fid: number;
};

/**
 * Adds a block for a given FID
 *
 * Automatically invalidates block list and feed queries to keep UI in sync.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link UseBlockUserParams}`) => void` - Trigger block operation
 *
 * @example
 * ```tsx
 * function BlockButton({ targetFid, signerUuid }: { targetFid: number; signerUuid: string }) {
 *   const blockUser = useBlockUser({
 *     onSuccess: () => {
 *       console.log('User blocked successfully');
 *     },
 *     onError: (error) => {
 *       console.error('Failed to block user:', error);
 *     }
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => blockUser.mutate({ signer_uuid: signerUuid, blocked_fid: targetFid })}
 *       disabled={blockUser.isPending}
 *     >
 *       {blockUser.isPending ? 'Blocking...' : 'Block User'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useUnblockUser} for unblocking users
 * @see {@link useBlockList} for fetching block list
 */
export function useBlockUser(
  options?: ExtendedMutationOptions<OperationResponse, BlockReqBody>,
): MutationHookResult<OperationResponse, BlockReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<OperationResponse, BlockReqBody>(
    "/api/neynar/blocks",
    "POST",
    {
      onMutate: async (variables) => {
        // Validate required parameters
        if (!variables.signer_uuid) {
          throw new Error("signer_uuid is required to block a user");
        }
        if (!variables.blocked_fid) {
          throw new Error("blocked_fid is required to block a user");
        }
      },
      onSuccess: (data, variables) => {
        // Invalidate block list and user-related queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.blocks.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.feeds.all(),
        });

        // Specifically invalidate queries for the blocker to ensure immediate UI updates
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.blocks.list({
            blocker_fid: variables.blocked_fid,
          }),
        });
      },
      ...options,
    },
  );
}

/**
 * Parameters for unblocking a user
 *
 * @see {@link useUnblockUser}
 */
export type UseUnblockUserParams = {
  /**
   * UUID of the signer
   *
   * `signer_uuid` is paired with API key, can't use a `uuid` made with a different API key.
   */
  signer_uuid: string;

  /**
   * The unique identifier of a farcaster user or app (unsigned integer)
   */
  blocked_fid: number;
};

/**
 * Deletes a block for a given FID
 *
 * Automatically invalidates block list and feed queries to keep UI in sync.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link UseUnblockUserParams}`) => void` - Trigger unblock operation
 *
 * @example
 * ```tsx
 * function UnblockButton({ targetFid, signerUuid }: { targetFid: number; signerUuid: string }) {
 *   const unblockUser = useUnblockUser({
 *     onSuccess: () => {
 *       console.log('User unblocked successfully');
 *     },
 *     onError: (error) => {
 *       console.error('Failed to unblock user:', error);
 *     }
 *   });
 *
 *   return (
 *     <button
 *       onClick={() => unblockUser.mutate({ signer_uuid: signerUuid, blocked_fid: targetFid })}
 *       disabled={unblockUser.isPending}
 *     >
 *       {unblockUser.isPending ? 'Unblocking...' : 'Unblock User'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useBlockUser} for blocking users
 * @see {@link useBlockList} for fetching block list
 */
export function useUnblockUser(
  options?: ExtendedMutationOptions<OperationResponse, BlockReqBody>,
): MutationHookResult<OperationResponse, BlockReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<OperationResponse, BlockReqBody>(
    "/api/neynar/blocks",
    "DELETE",
    {
      onMutate: async (variables) => {
        // Validate required parameters
        if (!variables.signer_uuid) {
          throw new Error("signer_uuid is required to unblock a user");
        }
        if (!variables.blocked_fid) {
          throw new Error("blocked_fid is required to unblock a user");
        }
      },
      onSuccess: (data, variables) => {
        // Invalidate block list and user-related queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.blocks.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.feeds.all(),
        });

        // Specifically invalidate queries for the blocker to ensure immediate UI updates
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.blocks.list({
            blocker_fid: variables.blocked_fid,
          }),
        });
      },
      ...options,
    },
  );
}
