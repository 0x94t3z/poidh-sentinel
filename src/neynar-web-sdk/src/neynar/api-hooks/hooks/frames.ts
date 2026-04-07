/**
 * Neynar Frames API hooks
 *
 * Comprehensive set of hooks covering all frame-related endpoints from buildNeynarRoutes.
 * Includes frame actions, validation, catalog, search, and Neynar frame management.
 *
 * @module neynar/hooks/frames
 * @see https://docs.neynar.com/reference for API reference
 */

import {
  useApiQuery,
  useApiMutation,
  useApiQueryClient,
  useApiInfiniteQuery,
  STALE_TIME,
  type ExtendedMutationOptions,
  type InfiniteQueryHookOptions,
  type MutationHookResult,
  type QueryHookOptions,
  type QueryHookResult,
  type InfiniteQueryHookResult,
  type InfiniteDataPage,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type { ApiParams } from "../types";
import type {
  Frame,
  FrameActionReqBody,
  FrameAction,
  ValidateFrameActionResponse,
  FrameCatalogResponse,
  FetchFrameMetaTagsFromUrl200Response,
  FetchRelevantFrames200Response,
  FrameValidateAnalyticsResponse,
  NeynarFrame,
  DeleteFrameResponse,
  FrameNotificationTokens,
  SendFrameNotificationsResponse,
  FrameV2WithFullAuthor,
  FetchRelevantFrames200ResponseRelevantFramesInner,
  FrameNotificationTokensNotificationTokensInner,
} from "../sdk-response-types";

// Frame-specific parameter types
export type FrameActionParams = FrameActionReqBody;

export type FrameCatalogParams = ApiParams<{
  /** Filter by frame categories (Valid values: 'games', 'social', 'finance', 'utility', 'productivity', 'health-fitness', 'news-media', 'music', 'shopping', 'education', 'developer-tools', 'entertainment', 'art-creativity'. Includes all categories if left blank) */
  category?: string;
}>;

export type FrameMetaTagsParams = {
  /** The URL to extract frame meta tags from */
  url: string;
};

export type FrameSearchParams = ApiParams<{
  /** The search query string */
  q: string;
}>;

export type FrameAnalyticsParams = {
  /** URL of the frame to fetch analytics for (required) */
  frame_url: string;
  /** Type of analytics to fetch (required) */
  analytics_type:
    | "total-interactors"
    | "interactors"
    | "interactions-per-cast"
    | "input-text";
  /** Start timestamp (ISO 8601 format) (required) */
  start: string;
  /** Stop timestamp (ISO 8601 format) (required) */
  stop: string;
  /** Required for analytics_type=interactions-per-cast */
  aggregate_window?:
    | "10s"
    | "1m"
    | "2m"
    | "5m"
    | "10m"
    | "20m"
    | "30m"
    | "2h"
    | "12h"
    | "1d"
    | "7d";
};

export type NeynarFrameParams = {
  /** Frame name */
  name?: string;
  /** Frame description */
  description?: string;
  /** Frame URL */
  url?: string;
};

export type NotificationTokenParams = {
  /** Comma separated list of FIDs, up to 100 at a time */
  fids?: string;
  /** Number of results to fetch (Default: 20, Maximum: 100) */
  limit?: number;
  /** Pagination cursor */
  cursor?: string;
};

/**
 * Post frame action
 *
 * Submits a frame action to process user interactions with frames. This mutation
 * handles button clicks, input submissions, and other frame interactions, processing
 * the signed frame message and returning the next frame state or action result.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example Basic frame action
 * ```tsx
 * const postFrameAction = usePostFrameAction({
 *   onSuccess: (result) => {
 *     console.log('Frame action successful:', result);
 *   },
 * });
 *
 * const handleFrameAction = () => {
 *   postFrameAction.mutate({
 *     untrustedData: {
 *       fid: 123,
 *       url: 'https://example.com/frame',
 *       messageHash: '0x...',
 *       timestamp: Date.now(),
 *       network: 1,
 *       buttonIndex: 1,
 *     },
 *     trustedData: {
 *       messageBytes: 'encoded_message',
 *     },
 *   });
 * };
 * ```
 *
 * @see {@link usePostFrameActionDeveloperManaged} for developer-managed frame action processing with custom logic
 * @see {@link useValidateFrameAction} for validating frame actions without executing them
 */
export function usePostFrameAction(
  options?: ExtendedMutationOptions<FrameAction, FrameActionParams>,
): MutationHookResult<FrameAction, FrameActionParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<FrameAction, FrameActionParams>(
    "/api/neynar/frames/action",
    "POST",
    {
      onSuccess: () => {
        // Invalidate frame analytics and relevant queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * Post frame action (developer managed)
 *
 * Submits a frame action for developer-managed frames, providing more control
 * over the frame action processing pipeline. This variant allows developers to
 * handle frame state and responses with custom logic rather than using Neynar's
 * default frame handling.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example Developer-managed frame action
 * ```tsx
 * const postDeveloperFrameAction = usePostFrameActionDeveloperManaged({
 *   onSuccess: (result) => {
 *     console.log('Developer frame action successful:', result);
 *   },
 * });
 * ```
 *
 * @see {@link usePostFrameAction} for standard frame action processing with Neynar's default handling
 * @see {@link useValidateFrameAction} for validating frame actions without executing them
 */
export function usePostFrameActionDeveloperManaged(
  options?: ExtendedMutationOptions<FrameAction, FrameActionParams>,
): MutationHookResult<FrameAction, FrameActionParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<FrameAction, FrameActionParams>(
    "/api/neynar/frames/action/developer-managed",
    "POST",
    {
      onSuccess: () => {
        // Invalidate frame analytics and relevant queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.all(),
        });
      },
      ...options,
    },
  );
}

type UseValidateFrameActionParams = {
  /** URL of the frame to validate */
  url: string;

  /** Optional post URL for frame action validation */
  postUrl?: string;
};

/**
 * Validate frame action
 *
 * Validates a frame action without executing it. Useful for testing frame
 * interactions, debugging frame implementations, and ensuring frame URLs
 * conform to the Frames specification.
 *
 * @param options - Mutation options including params and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example Frame validation
 * ```tsx
 * const validateFrameAction = useValidateFrameAction({
 *   onSuccess: (result) => {
 *     console.log('Frame action is valid:', result);
 *   },
 * });
 *
 * const handleValidation = () => {
 *   validateFrameAction.mutate({
 *     url: 'https://example.com/frame',
 *     postUrl: 'https://example.com/frame/action',
 *   });
 * };
 * ```
 *
 * @see {@link usePostFrameAction} for executing frame actions after validation
 * @see {@link useFrameMetaTags} for extracting frame metadata from URLs
 */
export function useValidateFrameAction(
  options?: ExtendedMutationOptions<
    ValidateFrameActionResponse,
    UseValidateFrameActionParams
  >,
): MutationHookResult<
  ValidateFrameActionResponse,
  UseValidateFrameActionParams
> {
  return useApiMutation<
    ValidateFrameActionResponse,
    UseValidateFrameActionParams
  >("/api/neynar/frames/validate", "POST", options);
}

/**
 * Fetch frame catalog
 *
 * Retrieves a paginated list of frames from the Neynar frame catalog with infinite
 * scroll support. The catalog includes verified and popular frames available on the
 * platform. Results are automatically flattened across pages for easy rendering.
 *
 * @param params - Optional parameters for filtering the catalog
 *   - `categories?: Array<string>` - Filter by frame categories (comma-separated or array). Valid values: 'games', 'social', 'finance', 'utility', 'productivity', 'health-fitness', 'news-media', 'music', 'shopping', 'education', 'developer-tools', 'entertainment', 'art-creativity'. Includes all categories if left blank
 *   - `time_window?: string` - Time window for trending score calculation. Valid values: '1h', '6h', '12h', '24h', '7d'
 *   - `networks?: Array<string>` - Filter by blockchain networks (comma-separated or array). Valid values: 'ethereum', 'base', 'arbitrum', 'arbitrum-sepolia', 'base-sepolia', 'degen', 'gnosis', 'optimism', 'optimism-sepolia', 'polygon', 'ethereum-sepolia', 'zora', 'unichain', 'monad-testnet', 'celo', 'solana'
 *   - `limit?: number` - Results per page (default: 100, max: 100)
 * @param options - Additional infinite query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated frame data
 *
 * @example Frame catalog with infinite scroll
 * ```tsx
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isLoading,
 * } = useFrameCatalog({
 *   category: 'games',
 * });
 *
 * const frames = data?.pages.flatMap(page => page.items) || [];
 *
 * return (
 *   <div>
 *     {frames.map((frame) => (
 *       <div key={frame.frames_url}>{frame.title}</div>
 *     ))}
 *     {hasNextPage && (
 *       <button onClick={() => fetchNextPage()}>Load More</button>
 *     )}
 *   </div>
 * );
 * ```
 *
 * @see {@link useFrameSearch} for searching frames by query string
 * @see {@link useRelevantFrames} for personalized frame recommendations
 */
export function useFrameCatalog(
  params?: FrameCatalogParams,
  options?: InfiniteQueryHookOptions<
    FrameCatalogResponse,
    FrameV2WithFullAuthor
  >,
): InfiniteQueryHookResult<FrameV2WithFullAuthor> {
  return useApiInfiniteQuery<
    FrameCatalogResponse,
    InfiniteDataPage<FrameV2WithFullAuthor>
  >(
    neynarQueryKeys.frames.catalog(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        { ...params },
        { cursor, limit: 100 },
      );
      return `/api/neynar/frames/catalog?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: FrameCatalogResponse) => ({
          items: page.frames || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Fetch frame meta tags from URL
 *
 * Extracts frame meta tags from a given URL to determine if it contains a valid
 * frame and retrieve its metadata. This is useful for frame validation, previews,
 * and ensuring proper frame configuration.
 *
 * @param url - The URL to extract frame meta tags from
 * @param options - Optional query configuration options
 * @returns TanStack Query result containing frame metadata
 *
 * @example Frame meta tags extraction
 * ```tsx
 * const { data: frameMetaTags, isLoading } = useFrameMetaTags(
 *   'https://example.com/frame',
 *   {
 *     onSuccess: (metaTags) => {
 *       console.log('Frame title:', metaTags.title);
 *       console.log('Frame image:', metaTags.image);
 *     },
 *   }
 * );
 *
 * if (isLoading) return <div>Loading frame...</div>;
 *
 * return (
 *   <div>
 *     <h2>{frameMetaTags?.title}</h2>
 *     <img src={frameMetaTags?.image} alt="Frame" />
 *   </div>
 * );
 * ```
 *
 * @see {@link useValidateFrameAction} for validating frame actions from URLs
 * @see {@link useNeynarFrameLookup} for looking up frames by UUID or URL
 */
export function useFrameMetaTags(
  url: string,
  options?: QueryHookOptions<FetchFrameMetaTagsFromUrl200Response, Frame>,
): QueryHookResult<Frame> {
  const queryParams = buildNeynarQuery({ url });

  return useApiQuery<FetchFrameMetaTagsFromUrl200Response, Frame>(
    neynarQueryKeys.frames.metaTags(url),
    `/api/neynar/frames/meta-tags?${queryParams}`,
    {
      enabled: Boolean(url?.trim()),
      staleTime: STALE_TIME.VERY_STABLE,
      ...options,
      select: (response: FetchFrameMetaTagsFromUrl200Response) => {
        // SDK returns: { frame: Frame }
        // Extract the frame object which contains all meta tags
        return response?.frame;
      },
    },
  );
}

type UseRelevantFramesParams = {
  /** FID of viewing user for personalized recommendations */
  viewer_fid: number;

  /** Time window for limiting statistics used to calculate relevance. Valid values: '1h', '6h', '12h', '24h', '7d' */
  time_window?: string;

  /** Filter by blockchain networks. Valid values: 'ethereum', 'base', 'arbitrum', 'arbitrum-sepolia', 'base-sepolia', 'degen', 'gnosis', 'optimism', 'optimism-sepolia', 'polygon', 'ethereum-sepolia', 'zora', 'unichain', 'monad-testnet', 'celo', 'solana' */
  networks?: string[];
};

/**
 * Fetch relevant frames
 *
 * Retrieves frames that are relevant to the current user or context based on their
 * activity and social graph. This endpoint provides personalized frame recommendations
 * with context about which users in the network are engaging with each frame.
 *
 * @param params - Parameters for filtering relevant frames
 * @param options - Optional query configuration options
 * @returns TanStack Query result containing array of relevant frames with user context
 *
 * @example Personalized frame recommendations
 * ```tsx
 * const { data: relevantFrames, isLoading } = useRelevantFrames(
 *   {
 *     viewer_fid: 123,
 *   },
 *   {
 *     onSuccess: (frames) => {
 *       console.log(`Found ${frames.length} relevant frames`);
 *     },
 *   }
 * );
 *
 * return (
 *   <div>
 *     {relevantFrames?.map((item) => (
 *       <div key={item.frame.frames_url}>
 *         <h3>{item.frame.title}</h3>
 *         <div>
 *           {item.top_relevant_users.map(user => (
 *             <img key={user.fid} src={user.pfp_url} alt={user.display_name} />
 *           ))}
 *         </div>
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 *
 * @see {@link useFrameCatalog} for browsing all frames in the catalog
 * @see {@link useFrameSearch} for searching frames by query string
 */
export function useRelevantFrames(
  params: UseRelevantFramesParams,
  options?: QueryHookOptions<
    FetchRelevantFrames200Response,
    FetchRelevantFrames200ResponseRelevantFramesInner[]
  >,
): QueryHookResult<FetchRelevantFrames200ResponseRelevantFramesInner[]> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<
    FetchRelevantFrames200Response,
    FetchRelevantFrames200ResponseRelevantFramesInner[]
  >(
    neynarQueryKeys.frames.relevant(params),
    `/api/neynar/frames/relevant?${queryParams}`,
    {
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (response: FetchRelevantFrames200Response) => {
        // SDK returns: { relevant_frames: Array<{ frame, top_relevant_users, remaining_relevant_users }> }
        // Return the full array to preserve frame + user context
        return response?.relevant_frames || [];
      },
    },
  );
}

/**
 * Search frames
 *
 * Searches for frames based on a query string with infinite scroll support.
 * Supports searching by frame title, description, or other metadata with
 * fuzzy matching and relevance ranking.
 *
 * @param query - The search query string
 * @param params - Optional additional search parameters
 * @param options - Additional infinite query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated search results
 *
 * @example Frame search with infinite scroll
 * ```tsx
 * const {
 *   data,
 *   fetchNextPage,
 *   hasNextPage,
 *   isLoading,
 * } = useFrameSearch('game', {
 *   limit: 20,
 * });
 *
 * const frames = data?.pages.flatMap(page => page.items) || [];
 *
 * return (
 *   <div>
 *     {frames.map((frame) => (
 *       <div key={frame.frames_url}>
 *         <h3>{frame.title}</h3>
 *         <p>{frame.metadata?.description}</p>
 *       </div>
 *     ))}
 *     {hasNextPage && (
 *       <button onClick={() => fetchNextPage()}>
 *         Load More Results
 *       </button>
 *     )}
 *   </div>
 * );
 * ```
 *
 * @see {@link useFrameCatalog} for browsing all frames without search query
 * @see {@link useRelevantFrames} for personalized frame recommendations
 */
export function useFrameSearch(
  query: string,
  params?: Omit<FrameSearchParams, "q">,
  options?: InfiniteQueryHookOptions<
    FrameCatalogResponse,
    FrameV2WithFullAuthor
  >,
): InfiniteQueryHookResult<FrameV2WithFullAuthor> {
  return useApiInfiniteQuery<
    FrameCatalogResponse,
    InfiniteDataPage<FrameV2WithFullAuthor>
  >(
    neynarQueryKeys.frames.search(query, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          q: query,
          ...params,
        },
        { cursor, limit: 20 },
      );
      return `/api/neynar/frames/search?${queryParams}`;
    },
    {
      enabled: Boolean(query?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: FrameCatalogResponse) => ({
          items: page.frames || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Fetch frame analytics
 *
 * Retrieves comprehensive analytics data for frames, including interaction counts,
 * performance metrics, usage statistics, and time-series data.
 *
 * @param params - Parameters for analytics query
 *   - `frame_url: string` - URL of the frame to fetch analytics for (required)
 *   - `analytics_type: string` - Type of analytics (required). Valid values: 'total-interactors', 'interactors', 'interactions-per-cast', 'input-text'
 *   - `start: string` - Start timestamp in ISO 8601 format (required)
 *   - `stop: string` - Stop timestamp in ISO 8601 format (required)
 *   - `aggregate_window?: string` - Time window for aggregation (required for analytics_type=interactions-per-cast). Valid values: '10s', '1m', '2m', '5m', '10m', '20m', '30m', '2h', '12h', '1d', '7d'
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with frame analytics data
 *
 * @example Basic analytics query
 * ```tsx
 * const { data: analytics, isLoading } = useFrameAnalytics({
 *   frame_url: 'https://example.com/frame',
 *   analytics_type: 'total-interactors',
 *   start: '2024-01-01T00:00:00Z',
 *   stop: '2024-01-31T23:59:59Z',
 * });
 * ```
 *
 * @example Interactions per cast with aggregation
 * ```tsx
 * const { data: analytics } = useFrameAnalytics({
 *   frame_url: 'https://example.com/frame',
 *   analytics_type: 'interactions-per-cast',
 *   start: '2024-01-01T00:00:00Z',
 *   stop: '2024-01-31T23:59:59Z',
 *   aggregate_window: '1d',
 * });
 * ```
 *
 * @see {@link usePostFrameAction} for triggering frame interactions that generate analytics
 */
export function useFrameAnalytics(
  params: FrameAnalyticsParams,
  options?: QueryHookOptions<
    FrameValidateAnalyticsResponse,
    FrameValidateAnalyticsResponse
  >,
): QueryHookResult<FrameValidateAnalyticsResponse> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<
    FrameValidateAnalyticsResponse,
    FrameValidateAnalyticsResponse
  >(
    neynarQueryKeys.frames.analytics(params),
    `/api/neynar/frames/analytics?${queryParams}`,
    {
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (response: FrameValidateAnalyticsResponse) => {
        // SDK returns: FrameValidateAnalyticsResponse (union type of different analytics)
        // Pass through the entire response - it's a discriminated union
        return response;
      },
    },
  );
}

/**
 * Publish Neynar frame
 *
 * Publishes a new frame to the Neynar frame registry. This makes the frame
 * discoverable and available for interactions on the Neynar platform. The frame
 * will appear in catalog searches and can be promoted to users.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example Publishing a frame
 * ```tsx
 * const publishFrame = usePublishNeynarFrame({
 *   onSuccess: (result) => {
 *     console.log('Frame published successfully:', result.frame_id);
 *   },
 *   onError: (error) => {
 *     console.error('Failed to publish frame:', error);
 *   },
 * });
 *
 * const handlePublish = () => {
 *   publishFrame.mutate({
 *     name: 'My Awesome Frame',
 *     description: 'An interactive frame for my users',
 *     url: 'https://myapp.com/frame',
 *   });
 * };
 * ```
 *
 * @see {@link useUpdateNeynarFrame} for updating existing frames
 * @see {@link useDeleteNeynarFrame} for removing frames from the registry
 */
export function usePublishNeynarFrame(
  options?: ExtendedMutationOptions<NeynarFrame, NeynarFrameParams>,
): MutationHookResult<NeynarFrame, NeynarFrameParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<NeynarFrame, NeynarFrameParams>(
    "/api/neynar/frames/neynar",
    "POST",
    {
      onSuccess: () => {
        // Invalidate frame catalog and lookup queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.catalog(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.lookup(),
        });
      },
      ...options,
    },
  );
}

/**
 * Update Neynar frame
 *
 * Updates an existing frame in the Neynar frame registry. Use this to modify
 * frame metadata, URL, description, or other properties. Automatically invalidates
 * related queries to keep the UI in sync.
 *
 * @param options - Additional mutation options for error handling and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example Updating a frame
 * ```tsx
 * const updateFrame = useUpdateNeynarFrame({
 *   onSuccess: (result) => {
 *     console.log('Frame updated successfully:', result);
 *   },
 * });
 *
 * const handleUpdate = () => {
 *   updateFrame.mutate({
 *     frame_id: 'existing-frame-id',
 *     name: 'Updated Frame Name',
 *     description: 'Updated description',
 *   });
 * };
 * ```
 *
 * @see {@link usePublishNeynarFrame} for publishing new frames
 * @see {@link useDeleteNeynarFrame} for removing frames from the registry
 */
export function useUpdateNeynarFrame(
  options?: ExtendedMutationOptions<
    NeynarFrame,
    NeynarFrameParams & { frame_id: string }
  >,
): MutationHookResult<NeynarFrame, NeynarFrameParams & { frame_id: string }> {
  const queryClient = useApiQueryClient();

  return useApiMutation<NeynarFrame, NeynarFrameParams & { frame_id: string }>(
    "/api/neynar/frames/neynar",
    "PUT",
    {
      onSuccess: () => {
        // Invalidate frame catalog and lookup queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.catalog(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.lookup(),
        });
      },
      ...options,
    },
  );
}

type UseDeleteNeynarFrameParams = {
  /** Frame ID to delete */
  frame_id: string;
};

/**
 * Delete Neynar frame
 *
 * Removes a frame from the Neynar frame registry. This action cannot be undone
 * and will make the frame unavailable for future interactions. The frame will be
 * removed from catalog listings and search results.
 *
 * @param options - Mutation options including params and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example Deleting a frame with confirmation
 * ```tsx
 * const deleteFrame = useDeleteNeynarFrame({
 *   onSuccess: () => {
 *     console.log('Frame deleted successfully');
 *     router.push('/frames');
 *   },
 *   onError: (error) => {
 *     console.error('Failed to delete frame:', error);
 *   },
 * });
 *
 * const handleDelete = () => {
 *   if (confirm('Are you sure you want to delete this frame?')) {
 *     deleteFrame.mutate({ frame_id: 'frame-to-delete' });
 *   }
 * };
 * ```
 *
 * @see {@link useUpdateNeynarFrame} for updating frame metadata instead of deleting
 * @see {@link useNeynarFrameLookup} for looking up frame details before deletion
 */
export function useDeleteNeynarFrame(
  options?: ExtendedMutationOptions<
    DeleteFrameResponse,
    UseDeleteNeynarFrameParams
  >,
): MutationHookResult<DeleteFrameResponse, UseDeleteNeynarFrameParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<DeleteFrameResponse, UseDeleteNeynarFrameParams>(
    "/api/neynar/frames/neynar",
    "DELETE",
    {
      onSuccess: () => {
        // Invalidate frame catalog and lookup queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.catalog(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.frames.lookup(),
        });
      },
      ...options,
    },
  );
}

type UseNeynarFrameLookupParams = {
  /** Type of identifier to use for lookup */
  type: "uuid" | "url";

  /** UUID of the frame (required when type='uuid') */
  uuid?: string;

  /** URL of the frame (required when type='url') */
  url?: string;
};

/**
 * Lookup Neynar frame
 *
 * Looks up a specific frame in the Neynar frame registry by UUID or URL.
 * Returns detailed frame information including metadata, status, and configuration.
 *
 * @param params - Parameters for frame lookup
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with frame data
 *
 * @example Frame lookup by UUID
 * ```tsx
 * const { data: frame, isLoading } = useNeynarFrameLookup({
 *   type: 'uuid',
 *   uuid: 'my-frame-uuid',
 * });
 * ```
 *
 * @example Frame lookup by URL
 * ```tsx
 * const { data: frameByUrl } = useNeynarFrameLookup({
 *   type: 'url',
 *   url: 'https://example.com/frame',
 * });
 * ```
 *
 * @see {@link useFrameMetaTags} for extracting frame metadata from URLs
 * @see {@link useUpdateNeynarFrame} for updating frame details after lookup
 */
export function useNeynarFrameLookup(
  params: UseNeynarFrameLookupParams,
  options?: QueryHookOptions<NeynarFrame, NeynarFrame>,
): QueryHookResult<NeynarFrame> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<NeynarFrame, NeynarFrame>(
    neynarQueryKeys.frames.lookup(params),
    `/api/neynar/frames/neynar/lookup?${queryParams}`,
    {
      enabled: Boolean(params.type && (params.uuid || params.url)),
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: NeynarFrame) => {
        // SDK returns: NeynarFrame directly (not wrapped)
        // Pass through the entire frame object
        return response;
      },
    },
  );
}

/**
 * Fetch notification tokens
 *
 * Retrieves notification tokens for frame interactions. These tokens are used
 * to send push notifications to users who have interacted with frames. Each token
 * represents a user's opt-in to receive notifications from your frame.
 *
 * @param params - Optional parameters for filtering notification tokens
 *   - `fids?: string` - Comma separated list of FIDs, up to 100 at a time
 *   - `limit?: number` - Results per page (default: 20, max: 100)
 *   - `cursor?: string` - Pagination cursor
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with notification token data
 *
 * @example Fetching all notification tokens
 * ```tsx
 * const { data: tokens, isLoading } = useNotificationTokens();
 * ```
 *
 * @example Fetching tokens for specific FIDs
 * ```tsx
 * const { data: tokens } = useNotificationTokens({
 *   fids: '123,456,789',
 * });
 * ```
 *
 * @see https://docs.neynar.com/reference/fetch-notification-tokens
 */
export function useNotificationTokens(
  params?: NotificationTokenParams,
  options?: QueryHookOptions<
    FrameNotificationTokens,
    FrameNotificationTokensNotificationTokensInner[]
  >,
): QueryHookResult<FrameNotificationTokensNotificationTokensInner[]> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<
    FrameNotificationTokens,
    FrameNotificationTokensNotificationTokensInner[]
  >(
    neynarQueryKeys.frames.notificationTokens(params),
    `/api/neynar/frames/notification-tokens?${queryParams}`,
    {
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: FrameNotificationTokens) => {
        // SDK returns: { notification_tokens: Array<FrameNotificationTokensNotificationTokensInner>, next: NextCursor }
        // Extract the notification tokens array
        return response?.notification_tokens || [];
      },
    },
  );
}

type UsePublishFrameNotificationsParams = {
  /** URL of the frame sending notification */
  frame_url: string;

  /** Notification title */
  title: string;

  /** Notification message body */
  message: string;

  /** Specific FIDs to notify (optional, defaults to all subscribers) */
  target_fids?: number[];
};

/**
 * Publish frame notifications
 *
 * Sends push notifications to users who have interacted with frames. Useful for
 * alerting users about frame updates, results, or new content. Notifications are
 * delivered via the Farcaster mobile app to users who have opted in.
 *
 * @param options - Mutation options including params and callbacks
 * @returns TanStack Query mutation result with mutate function and state
 *
 * @example Sending frame notifications
 * ```tsx
 * const publishNotifications = usePublishFrameNotifications({
 *   onSuccess: (result) => {
 *     console.log('Notifications sent successfully:', result);
 *   },
 *   onError: (error) => {
 *     console.error('Failed to send notifications:', error);
 *   },
 * });
 *
 * const handleSendNotifications = () => {
 *   publishNotifications.mutate({
 *     frame_url: 'https://myapp.com/frame',
 *     title: 'Frame Updated!',
 *     message: 'Your frame interaction has new results.',
 *     target_fids: [123, 456, 789],
 *   });
 * };
 * ```
 *
 * @example Broadcasting to all subscribers
 * ```tsx
 * const broadcastUpdate = () => {
 *   publishNotifications.mutate({
 *     frame_url: 'https://myapp.com/frame',
 *     title: 'New Feature Available',
 *     message: 'Check out the latest updates to our frame!',
 *   });
 * };
 * ```
 *
 * @see https://docs.neynar.com/reference/publish-frame-notifications
 * @see {@link useNotificationTokens} for retrieving notification tokens for specific users
 */
export function usePublishFrameNotifications(
  options?: ExtendedMutationOptions<
    SendFrameNotificationsResponse,
    UsePublishFrameNotificationsParams
  >,
): MutationHookResult<
  SendFrameNotificationsResponse,
  UsePublishFrameNotificationsParams
> {
  const queryClient = useApiQueryClient();

  return useApiMutation<
    SendFrameNotificationsResponse,
    UsePublishFrameNotificationsParams
  >("/api/neynar/frames/notifications", "POST", {
    onSuccess: () => {
      // Invalidate notification-related queries
      queryClient.invalidateQueries({
        queryKey: neynarQueryKeys.frames.notificationTokens(),
      });
    },
    ...options,
  });
}
