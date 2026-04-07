/**
 * Neynar Reactions API Hooks
 *
 * React Query hooks for Neynar reaction-related operations.
 * Uses TanStack Query v5 with proper error handling and type safety.
 */

import {
  useApiMutation,
  useApiInfiniteQuery,
  useApiQueryClient,
  STALE_TIME,
  type ExtendedMutationOptions,
  type InfiniteQueryHookOptions,
  type InfiniteDataPage,
  type InfiniteQueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type {
  ReactionsResponse,
  ReactionWithCastInfo,
} from "../sdk-response-types";

// ============================================================================
// Query Parameter Types
// ============================================================================

/**
 * Parameters for {@link useUserReactions}
 */
type UseUserReactionsParams = {
  /**
   * FID of viewing user for personalized results
   *
   * When provided, returns reactions that respect this user's mutes and blocks
   * and includes `viewer_context` on each cast with relationship information.
   */
  viewer_fid?: number;

  /**
   * Number of results to fetch per page
   *
   * - Default: 25
   * - Maximum: 100
   * - Minimum: 1
   */
  limit?: number;
};

// ============================================================================
// Mutation Parameter Types
// ============================================================================

/**
 * Parameters for {@link usePublishReaction} and {@link useDeleteReaction}
 */
type ReactionMutationParams = {
  /**
   * UUID of the signer for authentication
   *
   * **Required.** Must be approved to publish or delete reactions.
   * The `signer_uuid` is paired with your API key.
   */
  signer_uuid: string;

  /**
   * Type of reaction
   *
   * - `"like"` - Like/heart reaction
   * - `"recast"` - Recast/share reaction
   */
  reaction_type: "like" | "recast";

  /**
   * Target cast identifier
   *
   * Can be either:
   * - Cast hash: Hex string starting with `0x`
   * - Valid URL to the cast
   */
  target: string;

  /**
   * FID of the cast author (optional)
   *
   * The unique identifier of the user who authored the target cast.
   */
  target_author_fid?: number;

  /**
   * Idempotency key for request deduplication (optional but recommended)
   *
   * **Recommended format:** 16-character string generated at request time.
   *
   * **Purpose:**
   * - Prevents duplicate requests
   * - Use the same key on retry attempts
   * - Should be unique for each distinct request
   */
  idem?: string;
};

// ============================================================================
// Reaction Query Hooks
// ============================================================================

/**
 * Fetches reactions for a given user with infinite scroll pagination
 *
 * Retrieves all reactions (likes and recasts) made by a specific user. Each reaction
 * includes the complete cast that was reacted to.
 *
 * @param fid - The Farcaster ID of the user whose reactions to fetch
 * @param type - Type of reaction to fetch ("all" | "likes" | "recasts", default: "all")
 * @param params - Additional query parameters (see {@link UseUserReactionsParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated reaction data
 *
 * @example Basic user likes feed
 * ```tsx
 * function UserReactions({ fid }: { fid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useUserReactions(fid, "likes");
 *   const reactions = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {reactions.map(r => (
 *         <div key={r.cast.hash}>
 *           <p>{r.cast.text}</p>
 *           <small>Liked at {new Date(r.reaction_timestamp).toLocaleDateString()}</small>
 *         </div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link usePublishReaction} for creating new reactions on casts
 * @see {@link useDeleteReaction} for removing reactions from casts
 */
export function useUserReactions(
  fid: number,
  type: "all" | "likes" | "recasts" = "all",
  params?: UseUserReactionsParams,
  options?: InfiniteQueryHookOptions<ReactionsResponse, ReactionWithCastInfo>,
): InfiniteQueryHookResult<ReactionWithCastInfo> {
  return useApiInfiniteQuery<
    ReactionsResponse,
    InfiniteDataPage<ReactionWithCastInfo>
  >(
    neynarQueryKeys.reactions.byUser(fid, type, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          fid,
          type,
          ...params,
        },
        { cursor, limit: params?.limit ?? 25 },
      );
      return `/api/neynar/reactions/user?${queryParams}`;
    },
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: ReactionsResponse) => ({
          items: page.reactions || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

// ============================================================================
// Reaction Mutation Hooks
// ============================================================================

/**
 * Post a reaction (like or recast) to a given cast
 *
 * In order to post a reaction, the `signer_uuid` must be approved.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link ReactionMutationParams}`) => void` - Trigger reaction publish
 *
 * @example Basic like and recast buttons
 * ```tsx
 * function ReactionButtons({ cast, signerUuid }: { cast: Cast; signerUuid: string }) {
 *   const publishReaction = usePublishReaction();
 *
 *   const handleLike = () => {
 *     publishReaction.mutate({
 *       signer_uuid: signerUuid,
 *       reaction_type: "like",
 *       target: cast.hash
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleLike} disabled={publishReaction.isPending}>
 *       ❤️ {cast.reactions.likes_count}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useDeleteReaction} for removing reactions from casts
 * @see {@link useUserReactions} for viewing a user's reaction history
 */
export function usePublishReaction(
  options?: ExtendedMutationOptions<{ hash: string }, ReactionMutationParams>,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<{ hash: string }, ReactionMutationParams>(
    "/api/neynar/reactions",
    "POST",
    {
      onSuccess: (data, variables, context, meta) => {
        // Invalidate cast reactions using the correct query key pattern
        if (variables?.target) {
          queryClient.invalidateQueries({
            queryKey: neynarQueryKeys.reactions.byCast(
              variables.target,
              variables.reaction_type,
            ),
          });
          queryClient.invalidateQueries({
            queryKey: neynarQueryKeys.casts.byHash(variables.target),
          });
        }

        // Invalidate user reactions
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.reactions.all(),
        });

        // Call user-provided onSuccess callback
        options?.onSuccess?.(data, variables, context, meta);
      },
      ...options,
    },
  );
}

/**
 * Delete a reaction (like or recast) to a cast
 *
 * In order to delete a reaction, the `signer_uuid` must be approved.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link ReactionMutationParams}`) => void` - Trigger reaction delete
 *
 * @example Toggle reaction buttons with like/unlike
 * ```tsx
 * function ReactionToggle({ cast, signerUuid, isLiked }: {
 *   cast: Cast;
 *   signerUuid: string;
 *   isLiked: boolean;
 * }) {
 *   const publishReaction = usePublishReaction();
 *   const deleteReaction = useDeleteReaction();
 *
 *   const toggleLike = () => {
 *     if (isLiked) {
 *       deleteReaction.mutate({
 *         signer_uuid: signerUuid,
 *         reaction_type: "like",
 *         target: cast.hash
 *       });
 *     } else {
 *       publishReaction.mutate({
 *         signer_uuid: signerUuid,
 *         reaction_type: "like",
 *         target: cast.hash
 *       });
 *     }
 *   };
 *
 *   return (
 *     <button onClick={toggleLike} disabled={deleteReaction.isPending}>
 *       {isLiked ? '❤️' : '🤍'} {cast.reactions.likes_count}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link usePublishReaction} for adding reactions to casts
 * @see {@link useUserReactions} for viewing a user's reaction history
 */
export function useDeleteReaction(
  options?: ExtendedMutationOptions<
    { success: boolean },
    ReactionMutationParams
  >,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<{ success: boolean }, ReactionMutationParams>(
    "/api/neynar/reactions",
    "DELETE",
    {
      onSuccess: (data, variables, context, meta) => {
        // Invalidate cast reactions using the correct query key pattern
        if (variables?.target) {
          queryClient.invalidateQueries({
            queryKey: neynarQueryKeys.reactions.byCast(
              variables.target,
              variables.reaction_type,
            ),
          });
          queryClient.invalidateQueries({
            queryKey: neynarQueryKeys.casts.byHash(variables.target),
          });
        }

        // Invalidate user reactions
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.reactions.all(),
        });

        // Call user-provided onSuccess callback
        options?.onSuccess?.(data, variables, context, meta);
      },
      ...options,
    },
  );
}

// ============================================================================
// Utility Hooks
// ============================================================================
