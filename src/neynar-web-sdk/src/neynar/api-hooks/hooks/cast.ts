/**
 * Neynar Cast API Hooks
 *
 * React Query hooks for Neynar cast-related operations.
 * Comprehensive set of hooks covering all cast-related endpoints from buildNeynarRoutes.
 * Uses TanStack Query v5 with proper error handling, type safety, and cache management.
 *
 * This module provides hooks for:
 * - Cast retrieval (single, bulk, by author)
 * - Cast conversations and replies
 * - Cast reactions (likes, recasts)
 * - Cast search and discovery
 * - Cast composition and deletion
 * - Embedded content and metadata
 *
 * All hooks include proper TypeScript definitions, loading states, error handling,
 * and automatic cache invalidation for mutations.
 */

import {
  useApiQuery,
  useApiMutation,
  useApiInfiniteQuery,
  useApiQueryClient,
  normalizeFilters,
  STALE_TIME,
  type ExtendedMutationOptions,
  type InfiniteDataPage,
  type InfiniteQueryHookOptions,
  type InfiniteQueryHookResult,
  type MutationHookResult,
  type QueryHookOptions,
  type QueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";

// ============================================================================
// Parameter Types
// ============================================================================

type PublishCastParams = {
  /** Cast text content */
  text?: string;
  /** Array of embeds - see {@link PostCastReqBodyEmbeds} */
  embeds?: Array<{
    url?: string;
    cast_id?: {
      fid: number;
      hash: string;
    };
  }>;
  /** Hash of cast being replied to */
  reply_to?: string;
  /** Channel ID for channel posts */
  channel_id?: string;
  /** Parent author's FID */
  parent_author_fid?: number;
  /** Parent cast hash */
  parent_hash?: string;
  /** Hash of cast being quoted */
  quote?: string;
  /** Signer UUID for authentication */
  signer_uuid: string;
};

type ReactionParams = {
  /** Hash of the cast to react to */
  target_hash: string;
  /** Type of reaction */
  reaction_type: "like" | "recast";
  /** Signer UUID for authentication */
  signer_uuid: string;
};

import type {
  Cast,
  CastResponse,
  BulkCastsResponse,
  FetchCastQuotes200Response,
  CastsSearchResponse,
  ReactionsCastResponse,
  ReactionForCast,
  CastComposerActionsListResponse,
  CastComposerActionsListResponseActionsInner,
  CastEmbedCrawlResponse,
  PostCastResponse,
  Conversation,
  ConversationSummary,
  OperationResponse,
} from "../sdk-response-types";

type UseCastParams = {
  /**
   * Identifier type (REQUIRED - specify whether identifier is a hash or URL)
   */
  type: "hash" | "url";

  /**
   * When provided, adds `viewer_context` to show whether viewer has liked or recasted the cast
   */
  viewer_fid?: number;

  /**
   * Enables experimental features including filtering based on Neynar score (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;
};

/**
 * Gets information about an individual cast by passing in a Farcaster web URL or cast hash
 *
 * @param identifier - Cast hash or Warpcast URL to fetch
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with cast data
 *
 * @example Basic cast lookup
 * ```tsx
 * function CastDetail({ hash }: { hash: string }) {
 *   const { data: cast, isLoading } = useCast(hash, { type: "hash" });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h3>{cast?.author.display_name}</h3>
 *       <p>{cast?.text}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useBulkCasts} for fetching multiple casts at once
 * @see {@link useCastConversation} for fetching a cast with its conversation thread
 * @see {@link useCastsByUser} for fetching all casts by a specific user
 */
export function useCast(
  identifier: string,
  params: UseCastParams,
  options?: QueryHookOptions<CastResponse, Cast>,
): QueryHookResult<Cast> {
  const queryParams = buildNeynarQuery({
    identifier,
    ...params,
  });

  return useApiQuery<CastResponse, Cast>(
    neynarQueryKeys.casts.byHash(identifier, normalizeFilters(params)),
    `/api/neynar/casts/lookup?${queryParams}`,
    {
      enabled: Boolean(identifier?.trim()),
      staleTime: STALE_TIME.REALTIME,
      ...options,
      select: (response: CastResponse) => response.cast,
    },
  );
}

type UseBulkCastsParams = {
  /**
   * When provided, adds `viewer_context` to show whether viewer has liked or recasted each cast
   */
  viewer_fid?: number;

  /**
   * Enables experimental features including filtering based on Neynar score (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;

  /**
   * Optional parameter to sort the casts based on different criteria
   */
  sort_type?: "trending" | "likes" | "recasts" | "replies" | "recent";
};

/**
 * Fetch multiple casts by hashes
 *
 * Efficiently fetches multiple casts in a single API call using their hashes.
 *
 * @param hashes - Array of cast hashes to fetch
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with cast array data
 *
 * @example Fetching multiple casts
 * ```tsx
 * function CastList({ castHashes }: { castHashes: string[] }) {
 *   const { data: casts, isLoading } = useBulkCasts(castHashes);
 *
 *   if (isLoading) return <div>Loading casts...</div>;
 *
 *   return (
 *     <div>
 *       {casts?.map(cast => (
 *         <div key={cast.hash}>
 *           <p>{cast.text}</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCast} for fetching a single cast with more detailed options
 * @see {@link useCastsByUser} for fetching all casts by a specific user
 */
export function useBulkCasts(
  hashes: string[],
  params?: UseBulkCastsParams,
  options?: QueryHookOptions<BulkCastsResponse, Cast[]>,
): QueryHookResult<Cast[]> {
  const queryParams = buildNeynarQuery({
    casts: hashes,
    ...params,
  });

  return useApiQuery<BulkCastsResponse, Cast[]>(
    neynarQueryKeys.casts.byHashes(hashes, normalizeFilters(params)),
    `/api/neynar/casts/bulk?${queryParams}`,
    {
      enabled: hashes.length > 0,
      staleTime: STALE_TIME.REALTIME,
      ...options,
      select: (response: BulkCastsResponse) => response.casts || [],
    },
  );
}

type UseCastsByUserParams = {
  /**
   * Enables experimental features including filtering based on Neynar score (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;

  /**
   * Optionally filter to casts created via a specific app FID (e.g. 9152 for Warpcast)
   */
  app_fid?: number;

  /**
   * FID of the user viewing the feed (adds viewer context)
   */
  viewer_fid?: number;

  /**
   * Results per page (default: 25, max: 150)
   */
  limit?: number;

  /**
   * Include reply casts by the author in the response (default: true)
   */
  include_replies?: boolean;

  /**
   * Parent URL to filter the feed (mutually exclusive with channel_id)
   */
  parent_url?: string;

  /**
   * Channel ID to filter the feed (mutually exclusive with parent_url)
   */
  channel_id?: string;
};

/**
 * Retrieves casts posted by a specific user
 *
 * **Special Behaviors:**
 * - Limit: Default 25, Maximum 150
 * - `parent_url` and `channel_id` are mutually exclusive (provide one or neither, not both)
 *
 * @param fid - FID of user whose recent casts you want to fetch
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function UserTimeline({ fid }: { fid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useCastsByUser(fid);
 *   const casts = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {casts.map(cast => <div key={cast.hash}>{cast.text}</div>)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link usePopularCastsByUser} for fetching only the most popular casts by a user
 * @see {@link useRepliesAndRecastsByUser} for fetching specifically replies and recasts
 * @see {@link useUser} for fetching user profile information
 */
export function useCastsByUser(
  fid: number,
  params?: UseCastsByUserParams,
  options?: InfiniteQueryHookOptions<FetchCastQuotes200Response, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<
    FetchCastQuotes200Response,
    InfiniteDataPage<Cast>
  >(
    neynarQueryKeys.casts.byAuthor(fid, normalizeFilters(params)),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          fid,
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/casts/by-user?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: FetchCastQuotes200Response) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UsePopularCastsByUserParams = {
  /**
   * FID of viewing user for personalized context
   */
  viewer_fid?: number;

  /**
   * Maximum number of popular casts to return
   */
  limit?: number;
};

/**
 * Fetch popular casts by a user
 *
 * Retrieves the most popular casts from a specific user, ranked by engagement metrics
 * such as likes, recasts, and replies. Returns a fixed-size array of top-performing casts.
 *
 * @param fid - The FID of the user whose popular casts to fetch
 * @param params - Additional query parameters
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing array of popular casts, loading state, and error info
 *
 * @example User's top casts showcase
 * ```tsx
 * function UserTopCasts({ fid }: { fid: number }) {
 *   const { data: topCasts, isLoading } = usePopularCastsByUser(fid, { limit: 5 });
 *
 *   if (isLoading) return <div>Loading top casts...</div>;
 *
 *   return (
 *     <div>
 *       <h3>Most Popular Casts</h3>
 *       {topCasts?.map((cast, index) => (
 *         <div key={cast.hash}>
 *           <span>#{index + 1}</span>
 *           <p>{cast.text}</p>
 *           <div>
 *             <span>{cast.reactions.likes_count} likes</span>
 *             <span>{cast.reactions.recasts_count} recasts</span>
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCastsByUser} for fetching all casts by a user with pagination
 * @see {@link useRepliesAndRecastsByUser} for fetching specifically replies and recasts
 */
export function usePopularCastsByUser(
  fid: number,
  params?: UsePopularCastsByUserParams,
  options?: QueryHookOptions<BulkCastsResponse, Cast[]>,
): QueryHookResult<Cast[]> {
  const queryParams = buildNeynarQuery({
    fid,
    ...params,
  });

  return useApiQuery<BulkCastsResponse, Cast[]>(
    neynarQueryKeys.casts.byAuthor(
      fid,
      normalizeFilters({ ...params, popular: true }),
    ),
    `/api/neynar/casts/popular-by-user?${queryParams}`,
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: BulkCastsResponse) => response.casts || [],
    },
  );
}

type UseRepliesAndRecastsByUserParams = {
  /**
   * Filter to fetch only replies or recasts
   */
  filter?: "replies" | "recasts" | "all";

  /**
   * Results per page (default: 25, max: 50)
   */
  limit?: number;

  /**
   * When provided, returns a feed that respects this user's mutes and blocks and includes `viewer_context`
   */
  viewer_fid?: number;
};

/**
 * Retrieves replies and recasts for a user
 *
 * **Special Behaviors:**
 * - Limit: Default 25, Maximum 50
 *
 * @param fid - FID of user whose replies and recasts you want to fetch
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function UserActivity({ fid }: { fid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useRepliesAndRecastsByUser(fid, {
 *     filter: 'replies'
 *   });
 *   const casts = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {casts.map(cast => <div key={cast.hash}>{cast.text}</div>)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCastsByUser} for fetching all casts by a user including original posts
 * @see {@link usePopularCastsByUser} for fetching only the most popular casts
 */
export function useRepliesAndRecastsByUser(
  fid: number,
  params?: UseRepliesAndRecastsByUserParams,
  options?: InfiniteQueryHookOptions<FetchCastQuotes200Response, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<
    FetchCastQuotes200Response,
    InfiniteDataPage<Cast>
  >(
    neynarQueryKeys.casts.byAuthor(
      fid,
      normalizeFilters({ ...params, includeReplies: true }),
    ),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          fid,
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/casts/replies-and-recasts?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: FetchCastQuotes200Response) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseCastConversationParams = {
  /**
   * The query param accepted by the API (REQUIRED)
   */
  type: "hash" | "url";

  /**
   * Enables experimental features including filtering based on Neynar score (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;

  /**
   * The depth of replies in the conversation that will be returned (default: 2)
   */
  reply_depth?: number;

  /**
   * Include all parent casts in chronological order
   */
  include_chronological_parent_casts?: boolean;

  /**
   * When provided, returns conversation that respects this user's mutes and blocks and includes `viewer_context`
   */
  viewer_fid?: number;

  /**
   * Sort type for ordering of descendants (default: 'chron')
   */
  sort_type?: "chron" | "desc_chron" | "algorithmic";

  /**
   * Show conversation above or below the fold (lower quality responses hidden below fold)
   */
  fold?: "above" | "below";

  /**
   * Number of results to fetch (default: 20, max: 50)
   */
  limit?: number;
};

/**
 * Gets all casts related to a conversation surrounding a cast
 *
 * Includes all ancestors of a cast up to the root parent in chronological order.
 * Includes all direct_replies to the cast up to the reply_depth specified.
 *
 * **Special Behaviors:**
 * - Limit: Default 20, Maximum 50
 * - `type` parameter is required ('hash' or 'url')
 *
 * @param identifier - Cast identifier (hash or Warpcast URL)
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with conversation data
 *
 * @example
 * ```tsx
 * function CastThread({ hash }: { hash: string }) {
 *   const { data: conversation, isLoading } = useCastConversation(hash, {
 *     type: 'hash',
 *     reply_depth: 3
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   return <div>{conversation?.conversation.cast.text}</div>;
 * }
 * ```
 *
 * @see {@link useCast} for fetching just the cast without conversation thread
 * @see {@link useCastConversationSummary} for getting an AI-generated summary of the conversation
 */
export function useCastConversation(
  identifier: string,
  params: UseCastConversationParams,
  options?: QueryHookOptions<Conversation, Conversation>,
): QueryHookResult<Conversation> {
  const queryParams = buildNeynarQuery({
    identifier,
    ...params,
  });

  return useApiQuery<Conversation, Conversation>(
    neynarQueryKeys.casts.conversation(identifier, normalizeFilters(params)),
    `/api/neynar/casts/conversation?${queryParams}`,
    {
      enabled: Boolean(identifier?.trim()),
      staleTime: STALE_TIME.REALTIME,
      ...options,
      select: (response: Conversation) => response,
    },
  );
}

type UseCastConversationSummaryParams = {
  /**
   * Number of casts to consider in summary (default: 20, max: 50)
   */
  limit?: number;

  /**
   * Additional prompt used to generate summary
   */
  prompt?: string;
};

/**
 * Generates an LLM-powered summary of a conversation thread
 *
 * **Special Behaviors:**
 * - Limit: Default 20, Maximum 50 (number of casts to consider in summary up to target cast)
 *
 * @param identifier - Cast identifier (hash or Warpcast URL)
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with conversation summary
 *
 * @example
 * ```tsx
 * function ConversationSummary({ hash }: { hash: string }) {
 *   const { data: summary, isLoading } = useCastConversationSummary(hash, {
 *     limit: 30
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   return <div>{summary?.summary?.text}</div>;
 * }
 * ```
 *
 * @see {@link useCastConversation} for fetching the full conversation thread without summary
 * @see {@link useCast} for fetching just the cast without conversation
 */
export function useCastConversationSummary(
  identifier: string,
  params?: UseCastConversationSummaryParams,
  options?: QueryHookOptions<ConversationSummary, ConversationSummary>,
): QueryHookResult<ConversationSummary> {
  const queryParams = buildNeynarQuery({
    identifier,
    ...params,
  });

  return useApiQuery<ConversationSummary, ConversationSummary>(
    neynarQueryKeys.casts.custom(
      "conversation-summary",
      identifier,
      normalizeFilters(params),
    ),
    `/api/neynar/casts/conversation/summary?${queryParams}`,
    {
      enabled: Boolean(identifier?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (response: ConversationSummary) => response,
    },
  );
}

type UseCastReactionsParams = {
  /**
   * Reaction types to search for (REQUIRED)
   */
  types: Array<"all" | "likes" | "recasts">;

  /**
   * When provided, returns reactions that respect this user's mutes and blocks and includes `viewer_context`
   */
  viewer_fid?: number;

  /**
   * Results per page (default: 25, max: 100)
   */
  limit?: number;
};

/**
 * Retrieves users who reacted to a cast with pagination
 *
 * **Special Behaviors:**
 * - Limit: Default 25, Maximum 100
 * - `types` parameter is required (can be array with 'all', 'likes', or 'recasts')
 *
 * @param hash - Cast hash to fetch reactions for
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated reaction data
 *
 * @example
 * ```tsx
 * function CastLikes({ hash }: { hash: string }) {
 *   const { data, fetchNextPage, hasNextPage } = useCastReactions(hash, {
 *     types: ['likes']
 *   });
 *   const reactions = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {reactions.map(r => <div key={r.user.fid}>{r.user.display_name}</div>)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useLikeCast} for adding a like reaction to a cast
 * @see {@link useUnlikeCast} for removing a like reaction from a cast
 */
export function useCastReactions(
  hash: string,
  params: UseCastReactionsParams,
  options?: InfiniteQueryHookOptions<ReactionsCastResponse, ReactionForCast>,
): InfiniteQueryHookResult<ReactionForCast> {
  return useApiInfiniteQuery<
    ReactionsCastResponse,
    InfiniteDataPage<ReactionForCast>
  >(
    neynarQueryKeys.casts.likes(hash, normalizeFilters(params)),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          hash,
          ...params,
        },
        { cursor, limit: params?.limit ?? 25 },
      );
      return `/api/neynar/casts/reactions?${queryParams}`;
    },
    {
      enabled: Boolean(hash?.trim()),
      staleTime: STALE_TIME.REALTIME,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: ReactionsCastResponse) => ({
          items: page.reactions || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseCastQuotesParams = {
  /**
   * The query param accepted by the API (REQUIRED)
   */
  type: "hash" | "url";

  /**
   * Enables experimental features including filtering based on Neynar score (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;

  /**
   * When provided, adds viewer context
   */
  viewer_fid?: number;

  /**
   * Results per page (default: 25, max: 100)
   */
  limit?: number;
};

/**
 * Retrieves casts that quote (reference) a specific cast
 *
 * **Special Behaviors:**
 * - Limit: Default 25, Maximum 100
 *
 * @param identifier - Cast identifier (hash or Warpcast URL)
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function CastQuotes({ hash }: { hash: string }) {
 *   const { data, fetchNextPage, hasNextPage } = useCastQuotes(hash, {
 *     type: 'hash'
 *   });
 *   const quotes = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {quotes.map(quote => <div key={quote.hash}>{quote.text}</div>)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCast} for fetching the original cast being quoted
 * @see {@link useCastConversation} for fetching replies to a cast instead of quotes
 */
export function useCastQuotes(
  identifier: string,
  params: UseCastQuotesParams,
  options?: InfiniteQueryHookOptions<FetchCastQuotes200Response, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<
    FetchCastQuotes200Response,
    InfiniteDataPage<Cast>
  >(
    neynarQueryKeys.casts.custom(
      "quotes",
      identifier,
      normalizeFilters(params),
    ),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          identifier,
          ...params,
        },
        { cursor, limit: params?.limit ?? 25 },
      );
      return `/api/neynar/casts/quotes?${queryParams}`;
    },
    {
      enabled: Boolean(identifier?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: FetchCastQuotes200Response) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseCastSearchParams = {
  /**
   * Enables experimental features including filtering based on Neynar score (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;

  /**
   * Search mode (default: 'literal')
   */
  mode?: "literal" | "semantic" | "hybrid";

  /**
   * Sort type (default: 'desc_chron')
   */
  sort_type?: "desc_chron" | "chron" | "algorithmic";

  /**
   * FID of user whose casts to search
   */
  author_fid?: number;

  /**
   * When provided, returns results that respect this user's mutes and blocks and includes `viewer_context`
   */
  viewer_fid?: number;

  /**
   * Parent URL of the casts to search
   */
  parent_url?: string;

  /**
   * Channel ID of the casts to search
   */
  channel_id?: string;

  /**
   * Results per page (default: 25, max: 100)
   */
  limit?: number;
};

/**
 * Search for casts based on a query string, with optional AND filters
 *
 * **Special Behaviors:**
 * - Limit: Default 25, Maximum 100
 * - Supports advanced operators: +, |, *, ", (), ~n, -, before:, after:
 *
 * @param query - Query string to search for casts (supports operators)
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function CastSearch() {
 *   const [q, setQ] = useState('');
 *   const { data, fetchNextPage, hasNextPage } = useCastSearch(q, {
 *     mode: 'hybrid'
 *   }, {
 *     enabled: q.length > 2
 *   });
 *   const casts = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       <input value={q} onChange={(e) => setQ(e.target.value)} />
 *       {casts.map(cast => <div key={cast.hash}>{cast.text}</div>)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCastsByUser} for searching casts by a specific user
 * @see {@link useCast} for fetching a specific cast by hash or URL
 */
export function useCastSearch(
  query: string,
  params?: UseCastSearchParams,
  options?: InfiniteQueryHookOptions<CastsSearchResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<CastsSearchResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.casts.search(query, normalizeFilters(params)),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          q: query,
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/casts/search?${queryParams}`;
    },
    {
      enabled: Boolean(query?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: CastsSearchResponse) => ({
          items: page.result?.casts || [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          nextCursor: (page as any).next?.cursor || null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hasNextPage: Boolean((page as any).next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseComposerActionsParams = {
  /**
   * Type of list to fetch (REQUIRED)
   */
  list: "top" | "featured";

  /**
   * Number of results to fetch (default: 25, max: 25)
   */
  limit?: number;

  /**
   * Cursor for pagination
   */
  cursor?: string;
};

/**
 * Retrieves available Farcaster composer actions
 *
 * **Special Behaviors:**
 * - Limit: Default 25, Maximum 25
 * - `list` parameter is required ('top' or 'featured')
 *
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with composer actions data
 *
 * @example
 * ```tsx
 * function ComposerActions() {
 *   const { data: actions, isLoading } = useComposerActions({
 *     list: 'featured'
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   return <div>{actions?.map(a => <div key={a.name}>{a.name}</div>)}</div>;
 * }
 * ```
 *
 * Maps to: GET /casts/composer-actions
 */
export function useComposerActions(
  params: UseComposerActionsParams,
  options?: QueryHookOptions<
    CastComposerActionsListResponse,
    CastComposerActionsListResponseActionsInner[]
  >,
): QueryHookResult<CastComposerActionsListResponseActionsInner[]> {
  const queryParams = buildNeynarQuery(params);

  return useApiQuery<
    CastComposerActionsListResponse,
    CastComposerActionsListResponseActionsInner[]
  >(
    neynarQueryKeys.casts.custom("composer-actions", normalizeFilters(params)),
    `/api/neynar/casts/composer-actions?${queryParams}`,
    {
      staleTime: STALE_TIME.STABLE,
      ...options,
      select: (response: CastComposerActionsListResponse) =>
        response.actions || [],
    },
  );
}

/**
 * Fetch embedded URL metadata
 *
 * Crawls and retrieves metadata (title, description, images) for a URL to be embedded in a cast.
 * Useful for generating rich previews of links before posting.
 *
 * @param url - The URL to fetch metadata for
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing URL metadata, loading state, and error info
 *
 * @example Link preview generation
 * ```tsx
 * function LinkPreview({ url }: { url: string }) {
 *   const { data: metadata, isLoading } = useEmbeddedUrlMetadata(url);
 *
 *   if (isLoading) return <div>Loading preview...</div>;
 *   if (!metadata) return null;
 *
 *   return (
 *     <div>
 *       {metadata.metadata.image && <img src={metadata.metadata.image.url} alt={metadata.metadata.html?.title} />}
 *       <h4>{metadata.metadata.html?.title || url}</h4>
 *       <p>{metadata.metadata.html?.description}</p>
 *       {metadata.metadata.html?.site_name && <span>{metadata.metadata.html.site_name}</span>}
 *     </div>
 *   );
 * }
 * ```
 *
 * Maps to: GET /casts/embedded-url-metadata
 */
export function useEmbeddedUrlMetadata(
  url: string,
  options?: QueryHookOptions<CastEmbedCrawlResponse, CastEmbedCrawlResponse>,
): QueryHookResult<CastEmbedCrawlResponse> {
  const queryParams = buildNeynarQuery({ url });

  return useApiQuery<CastEmbedCrawlResponse, CastEmbedCrawlResponse>(
    neynarQueryKeys.casts.custom("embedded-url-metadata", { url }),
    `/api/neynar/casts/embedded-url-metadata?${queryParams}`,
    {
      enabled: Boolean(url?.trim()),
      staleTime: STALE_TIME.VERY_STABLE,
      ...options,
      select: (response: CastEmbedCrawlResponse) => response,
    },
  );
}

/**
 * Publish a new cast
 *
 * Creates and publishes a new cast to Farcaster. Supports text, embeds, channel posting,
 * and replies. Automatically invalidates relevant feeds and conversations on success.
 *
 * @param options - Additional mutation options
 *   - `onSuccess?: (data, variables) => void` - Called after successful publish
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result
 *   - `mutate: (params: PublishCastParams) => void` - Trigger cast publish
 *   - `isPending: boolean` - True while publishing
 *   - `isError: boolean` - True if publish failed
 *   - `error: ApiError | null` - Error if failed
 *   - `isSuccess: boolean` - True if publish succeeded
 *
 * **Mutation Parameters:**
 * ```typescript
 * {
 *   signer_uuid: string;            // Signer UUID for authentication
 *   text: string;                   // Cast content (max 320 characters)
 *   embeds?: Array<{                // Optional embeds
 *     url?: string;                 // URL to embed
 *     cast_id?: {                   // Quote cast
 *       fid: number;
 *       hash: string;
 *     };
 *   }>;
 *   channel_id?: string;            // Optional channel to post in
 *   reply_to?: string;              // Hash of cast to reply to
 *   parent?: string;                // Parent cast hash for threading
 * }
 * ```
 *
 * @example Basic cast publishing
 * ```tsx
 * function ComposeC ast({ signerUuid }: { signerUuid: string }) {
 *   const [text, setText] = useState('');
 *   const publishMutation = usePublishCast({
 *     onSuccess: (data) => {
 *       console.log('Published cast:', data.cast.hash);
 *       setText('');
 *     },
 *     onError: (error) => alert('Failed to publish: ' + error.message)
 *   });
 *
 *   return (
 *     <div>
 *       <textarea
 *         value={text}
 *         onChange={(e) => setText(e.target.value)}
 *         maxLength={320}
 *         placeholder="What's happening?"
 *       />
 *       <button
 *         onClick={() => publishMutation.mutate({
 *           signer_uuid: signerUuid,
 *           text
 *         })}
 *         disabled={!text.trim() || publishMutation.isPending}
 *       >
 *         {publishMutation.isPending ? 'Publishing...' : 'Cast'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * Maps to: POST /casts
 */
export function usePublishCast(
  options?: ExtendedMutationOptions<PostCastResponse, PublishCastParams>,
): MutationHookResult<PostCastResponse, PublishCastParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<PostCastResponse, PublishCastParams>(
    "/api/neynar/casts",
    "POST",
    {
      onSuccess: (_, variables) => {
        // Invalidate relevant feeds and user casts
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.feeds.all(),
        });

        // If it's a reply, invalidate the conversation
        if (variables.reply_to) {
          queryClient.invalidateQueries({
            queryKey: neynarQueryKeys.casts.conversation(variables.reply_to),
          });
        }

        // If it has a channel, invalidate channel feed
        if (variables.channel_id) {
          queryClient.invalidateQueries({
            queryKey: neynarQueryKeys.feeds.channel(variables.channel_id),
          });
        }
      },
      ...options,
    },
  );
}

/**
 * Delete a cast
 *
 * Permanently removes a cast from Farcaster. Automatically invalidates relevant feeds
 * and the cast itself to update UI. This action cannot be undone.
 *
 * @param options - Additional mutation options for error handling and callbacks
 *   - `onSuccess?: (data, variables) => void` - Called after successful deletion
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result
 *   - `mutate: (params: { cast_hash: string, signer_uuid: string }) => void` - Trigger delete
 *   - `isPending: boolean` - True while deleting
 *   - `isError: boolean` - True if delete failed
 *   - `error: ApiError | null` - Error if failed
 *   - `isSuccess: boolean` - True if delete succeeded
 *
 * **Mutation Parameters:**
 * ```typescript
 * {
 *   cast_hash: string;              // Hash of cast to delete
 *   signer_uuid: string;            // Signer UUID for authentication (must own the cast)
 * }
 * ```
 *
 * @example Delete cast with confirmation
 * ```tsx
 * function DeleteCastButton({ cast, signerUuid }: { cast: Cast; signerUuid: string }) {
 *   const deleteMutation = useDeleteCast({
 *     onSuccess: () => {
 *       console.log('Cast deleted successfully');
 *     },
 *     onError: (error) => alert('Failed to delete: ' + error.message)
 *   });
 *
 *   const handleDelete = () => {
 *     if (confirm('Are you sure you want to delete this cast?')) {
 *       deleteMutation.mutate({
 *         cast_hash: cast.hash,
 *         signer_uuid: signerUuid
 *       });
 *     }
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleDelete}
 *       disabled={deleteMutation.isPending}
 *       className="text-red-600"
 *     >
 *       {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
 *     </button>
 *   );
 * }
 * ```
 *
 * Maps to: DELETE /casts
 */
export function useDeleteCast(
  options?: ExtendedMutationOptions<
    OperationResponse,
    { cast_hash: string; signer_uuid: string }
  >,
): MutationHookResult<
  OperationResponse,
  { cast_hash: string; signer_uuid: string }
> {
  const queryClient = useApiQueryClient();

  return useApiMutation<
    OperationResponse,
    { cast_hash: string; signer_uuid: string }
  >("/api/neynar/casts", "DELETE", {
    onSuccess: (_, variables) => {
      // Invalidate the specific cast and related feeds
      queryClient.invalidateQueries({
        queryKey: neynarQueryKeys.casts.byHash(variables.cast_hash),
      });
      queryClient.invalidateQueries({
        queryKey: neynarQueryKeys.feeds.all(),
      });
    },
    ...options,
  });
}

/**
 * Like a cast
 *
 * Adds a like reaction to a cast. Automatically invalidates cast reactions and the cast
 * itself to update UI with new like count and viewer context.
 *
 * @param options - Additional mutation options
 *   - `onSuccess?: (data, variables) => void` - Called after successful like
 *   - `onError?: (error) => void` - Called on error
 * @returns TanStack Query mutation result
 *   - `mutate: (params: { target_hash: string, signer_uuid: string }) => void` - Trigger like
 *   - `isPending: boolean` - True while liking
 *   - `isError: boolean` - True if like failed
 *   - `isSuccess: boolean` - True if like succeeded
 *
 * **Mutation Parameters:**
 * ```typescript
 * {
 *   target_hash: string;            // Hash of cast to like
 *   signer_uuid: string;            // Signer UUID for authentication
 *   reaction_type?: 'like';         // Reaction type (defaults to 'like')
 * }
 * ```
 *
 * @example Like button
 * ```tsx
 * function LikeButton({ cast, signerUuid }: { cast: Cast; signerUuid: string }) {
 *   const likeMutation = useLikeCast();
 *   const isLiked = cast.viewer_context?.liked;
 *
 *   return (
 *     <button
 *       onClick={() => likeMutation.mutate({
 *         target_hash: cast.hash,
 *         signer_uuid: signerUuid
 *       })}
 *       disabled={likeMutation.isPending || isLiked}
 *     >
 *       {isLiked ? '❤️' : '🤍'} {cast.reactions.likes_count}
 *     </button>
 *   );
 * }
 * ```
 *
 * Maps to: POST /reactions
 */
export function useLikeCast(
  options?: ExtendedMutationOptions<OperationResponse, ReactionParams>,
): MutationHookResult<OperationResponse, ReactionParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<OperationResponse, ReactionParams>(
    "/api/neynar/reactions",
    "POST",
    {
      onSuccess: (_, variables) => {
        // Invalidate cast reactions and the cast itself
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.casts.likes(variables.target_hash),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.casts.byHash(variables.target_hash),
        });
      },
      ...options,
    },
  );
}

/**
 * Unlike a cast
 *
 * Removes a like reaction from a cast. Automatically invalidates cast reactions and the cast
 * itself to update UI with the removed like and updated count.
 *
 * @param options - Additional mutation options for error handling and callbacks
 *   - `onSuccess?: (data, variables) => void` - Called after successful unlike
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result
 *   - `mutate: (params: { target_hash: string, signer_uuid: string }) => void` - Trigger unlike
 *   - `isPending: boolean` - True while unliking
 *   - `isError: boolean` - True if unlike failed
 *   - `isSuccess: boolean` - True if unlike succeeded
 *
 * **Mutation Parameters:**
 * ```typescript
 * {
 *   target_hash: string;            // Hash of cast to unlike
 *   signer_uuid: string;            // Signer UUID for authentication
 *   reaction_type?: 'like';         // Reaction type (defaults to 'like')
 * }
 * ```
 *
 * @example Unlike button
 * ```tsx
 * function UnlikeButton({ cast, signerUuid }: { cast: Cast; signerUuid: string }) {
 *   const unlikeMutation = useUnlikeCast();
 *   const isLiked = cast.viewer_context?.liked;
 *
 *   if (!isLiked) return null;
 *
 *   return (
 *     <button
 *       onClick={() => unlikeMutation.mutate({
 *         target_hash: cast.hash,
 *         signer_uuid: signerUuid
 *       })}
 *       disabled={unlikeMutation.isPending}
 *     >
 *       {unlikeMutation.isPending ? 'Unliking...' : 'Unlike'}
 *     </button>
 *   );
 * }
 * ```
 *
 * Maps to: DELETE /reactions
 */
export function useUnlikeCast(
  options?: ExtendedMutationOptions<OperationResponse, ReactionParams>,
): MutationHookResult<OperationResponse, ReactionParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<OperationResponse, ReactionParams>(
    "/api/neynar/reactions",
    "DELETE",
    {
      onSuccess: (_, variables) => {
        // Invalidate cast reactions and the cast itself
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.casts.likes(variables.target_hash),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.casts.byHash(variables.target_hash),
        });
      },
      ...options,
    },
  );
}
