/**
 * Neynar Feed API hooks
 *
 * @fileoverview Comprehensive collection of React Query hooks for all Neynar feed endpoints.
 * Provides infinite scrolling support with cursor-based pagination, automatic error handling,
 * and consistent caching patterns across all feed types. All hooks integrate seamlessly with
 * the proxy API architecture and maintain type safety throughout.
 *
 * Feed types covered:
 * - User-specific feeds (following, for-you)
 * - Global feeds (trending, frames-only)
 * - Channel-based feeds (single, multi-channel, with child channels)
 * - Content-specific feeds (parent URL, filtered)
 *
 * All hooks support infinite query patterns with automatic pagination handling and
 * proper cache invalidation through hierarchical query keys.
 */

import {
  useApiInfiniteQuery,
  normalizeFilters,
  STALE_TIME,
  type InfiniteDataPage,
  type InfiniteQueryHookOptions,
  type InfiniteQueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type { Cast, FeedResponse } from "../sdk-response-types";

// ============================================================================
// Parameter Types
// ============================================================================

type UseFollowingFeedParams = {
  /** Number of results to fetch per page (Default: 25, Maximum: 100) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Include recasts in response (Default: true) */
  with_recasts?: boolean;

  /** Enable experimental features (sent as global header) */
  x_neynar_experimental?: boolean;
};

type UseForYouFeedParams = {
  /** Number of results to fetch per page (Default: 25, Maximum: 50) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Provider of the For You feed (only 'neynar' currently supported) */
  provider?: "neynar";

  /** Enable experimental features (sent as global header) */
  x_neynar_experimental?: boolean;
};

type UseTrendingFeedParams = {
  /** Number of results to fetch per page (Default: 10, Maximum: 10) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Time window for trending content ('7d' only available for channel feeds) */
  time_window?: "1h" | "6h" | "12h" | "24h" | "7d";

  /** Channel ID to filter trending casts (mutually exclusive with parent_url) */
  channel_id?: string;

  /** Parent URL to filter trending casts (mutually exclusive with channel_id) */
  parent_url?: string;

  /** Provider of trending feed */
  provider?: "neynar" | "openrank" | "mbd";

  /** URI-encoded JSON metadata for provider (only available for 'mbd' provider) */
  provider_metadata?: string;

  /** Enable experimental features (sent as global header) */
  x_neynar_experimental?: boolean;
};

type UseTrendingGlobalFeedParams = {
  /** Number of results to fetch per page (Default: 10, Maximum: 10) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Time window for trending content (do NOT use '7d' - only available for channel feeds) */
  time_window?: "1h" | "6h" | "12h" | "24h";

  /** Provider of trending feed */
  provider?: "neynar" | "openrank" | "mbd";
};

type UseChannelFeedParams = {
  /** Number of results to fetch per page (Default: 25, Maximum: 100) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Include recasts in response (Default: true) */
  with_recasts?: boolean;

  /** Include replies in response (Default: false) */
  with_replies?: boolean;

  /** Only include casts from channel members (Default: true) */
  members_only?: boolean;

  /** Comma separated list of FIDs to filter the feed by (max: 10) */
  fids?: string;

  /** Only show casts liked by channel moderator if moderator exists */
  should_moderate?: boolean;

  /** Enable experimental features (sent as global header) */
  x_neynar_experimental?: boolean;
};

type UseChannelAndChildFeedParams = {
  /** Number of results to fetch per page (Default: 25, Maximum: 100) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Include recasts in response (Default: true) */
  with_recasts?: boolean;

  /** Include replies in response (Default: false) */
  with_replies?: boolean;

  /** Only include casts from channel members (Default: true) */
  members_only?: boolean;

  /** Comma separated list of FIDs to filter the feed by (max: 10) */
  fids?: string;

  /** Only show casts liked by channel moderator if moderator exists */
  should_moderate?: boolean;

  /** Enable experimental features (sent as global header) */
  x_neynar_experimental?: boolean;
};

type UseMultiChannelFeedParams = {
  /** Number of results to fetch per page (Default: 25, Maximum: 100) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Include recasts in response (Default: true) */
  with_recasts?: boolean;

  /** Include replies in response (Default: false) */
  with_replies?: boolean;

  /** Only include casts from channel members (Default: true) */
  members_only?: boolean;

  /** Comma separated list of FIDs to filter the feed by (max: 10) */
  fids?: string;

  /** Only show casts liked by channel moderator if moderator exists */
  should_moderate?: boolean;

  /** Enable experimental features (sent as global header) */
  x_neynar_experimental?: boolean;
};

type UseParentUrlFeedParams = {
  /** Pagination cursor for fetching specific page (automatically managed in infinite queries) */
  cursor?: string;

  /** Number of results to fetch per page (Default: 25, Maximum: 100) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Include recasts in response (Default: true) */
  with_recasts?: boolean;

  /** Include replies in response (Default: false) */
  with_replies?: boolean;
};

type UseFramesFeedParams = {
  /** Pagination cursor for fetching specific page (automatically managed in infinite queries) */
  cursor?: string;

  /** Number of results to fetch per page (Default: 25, Maximum: 100) */
  limit?: number;

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;
};

type UseFilteredFeedParams = {
  /** Pagination cursor for fetching specific page (automatically managed in infinite queries) */
  cursor?: string;

  /** Number of results to fetch per page (Default: 25, Maximum: 100) */
  limit?: number;

  /** Feed type (Default: 'following' which requires FID, 'filter' requires filter_type parameter) */
  feed_type?: "following" | "filter";

  /** Filter type when feed_type='filter' */
  filter_type?:
    | "fids"
    | "parent_url"
    | "channel_id"
    | "embed_url"
    | "embed_types"
    | "global_trending";

  /** User's Farcaster ID (required for feed_type='following') */
  fid?: number;

  /** Comma separated list of FIDs (when filter_type='fids', max: 100) */
  fids?: string;

  /** Parent URL to filter by (when filter_type='parent_url') */
  parent_url?: string;

  /** Channel ID to filter by (when filter_type='channel_id') */
  channel_id?: string;

  /** Only include casts from channel members (when filter_type='channel_id', Default: true) */
  members_only?: boolean;

  /** Embedded URL prefix to filter by (when filter_type='embed_url') */
  embed_url?: string;

  /** Array of content embed types to filter by (when filter_type='embed_types') */
  embed_types?: string[];

  /** FID of viewer for personalized content (respects mutes/blocks, includes viewer_context) */
  viewer_fid?: number;

  /** Include recasts in response (Default: true) */
  with_recasts?: boolean;
};

/** Parameters for following feed (fetchUserFollowingFeed) */
export type FollowingFeedParams = UseFollowingFeedParams;

/** Parameters for For You feed (fetchFeedForYou) */
export type ForYouFeedParams = UseForYouFeedParams;

/** Parameters for trending feed (fetchTrendingFeed) */
export type TrendingFeedParams = UseTrendingFeedParams;

/** Parameters for channel feed (fetchFeedByChannelIds) */
export type ChannelFeedParams = UseChannelFeedParams;

/** Parameters for multi-channel feed (fetchFeedByChannelIds) */
export type MultiChannelFeedParams = UseMultiChannelFeedParams;

/** Parameters for parent URL feed (fetchFeedByParentUrls) */
export type ParentUrlFeedParams = UseParentUrlFeedParams;

/** Parameters for filtered feed (fetchFeed) - the generic feed endpoint */
export type FilteredFeedParams = UseFilteredFeedParams;

/**
 * Fetch feed based on who a user is following
 *
 * Retrieves posts from users that the specified user follows. This is the primary
 * timeline experience similar to a social media feed.
 *
 * @param fid - FID of user whose feed you want to create
 * @param params - Additional query parameters (see {@link UseFollowingFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function FollowingFeed({ fid }: { fid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useFollowingFeed(fid, {
 *     viewer_fid: 456,
 *     limit: 50
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useForYouFeed} for personalized algorithmic feed
 * @see {@link useChannelFeed} for channel-specific feeds
 * @see {@link useTrendingFeed} for trending content
 */
export function useFollowingFeed(
  fid: number,
  params?: UseFollowingFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.following(fid, normalizeFilters(params)),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          fid,
          ...params,
        },
        { cursor, limit: params?.limit ?? 25 },
      );
      return `/api/neynar/feed/following?${queryParams}`;
    },
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.REALTIME,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Retrieve a personalized "For You" feed for a user
 *
 * Fetches an algorithmic feed of recommended content personalized for the user.
 * Uses Neynar's algorithm to surface relevant posts based on user behavior and preferences.
 *
 * **Special Behaviors:**
 * - Lower limit maximum (max: 50 vs 100 for other feeds)
 * - Algorithm considers user's follows, interactions, and interests
 *
 * @param fid - FID of user whose personalized feed to retrieve
 * @param params - Additional query parameters (see {@link UseForYouFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function ForYouFeed({ fid }: { fid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useForYouFeed(fid, {
 *     limit: 50
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useFollowingFeed} for chronological feed from followed users
 * @see {@link useTrendingFeed} for trending content across the network
 */
export function useForYouFeed(
  fid: number,
  params?: UseForYouFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.forYou(fid, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          fid,
          ...params,
        },
        { cursor, limit: params?.limit ?? 25 },
      );
      return `/api/neynar/feed/for-you?${queryParams}`;
    },
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.REALTIME,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Fetch trending casts on global feed or channel feeds
 *
 * Retrieves currently trending content based on engagement metrics. Supports multiple
 * providers and time windows for flexible trending algorithms.
 *
 * **Special Behaviors:**
 * - Fixed limit of 10 (default: 10, max: 10) - cannot be changed
 * - `channel_id` and `parent_url` are mutually exclusive
 * - `time_window` '7d' only available when channel_id or parent_url is provided
 * - `provider_metadata` only available for 'mbd' provider
 *
 * @param params - Additional query parameters (see {@link UseTrendingFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function TrendingFeed() {
 *   const { data, fetchNextPage, hasNextPage } = useTrendingFeed({
 *     time_window: '24h',
 *     channel_id: 'farcaster'
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useTrendingGlobalFeed} for global trending without channel filters
 * @see {@link useFollowingFeed} for personalized chronological feed
 * @see {@link useChannelFeed} for all channel content (not just trending)
 */
export function useTrendingFeed(
  params?: UseTrendingFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.trending(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          ...params,
        },
        { cursor, limit: 10 }, // API max is 10 for trending feed
      );
      return `/api/neynar/feed/trending?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Fetch global trending casts (same as useTrendingFeed without channel filters)
 *
 * Retrieves trending content across the entire Farcaster network, not limited to
 * specific channels. Use this for discovering what's popular globally.
 *
 * **Special Behaviors:**
 * - Fixed limit of 10 (default: 10, max: 10) - cannot be changed
 * - Do NOT use '7d' time_window (only available for channel feeds)
 * - No channel or parent URL filtering
 *
 * @param params - Additional query parameters (see {@link UseTrendingGlobalFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function GlobalTrending() {
 *   const { data } = useTrendingGlobalFeed({ time_window: '24h' });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useTrendingFeed} for trending with channel or URL filtering
 * @see {@link useForYouFeed} for personalized algorithmic feed
 */
export function useTrendingGlobalFeed(
  params?: UseTrendingGlobalFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.trendingGlobal(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          ...params,
        },
        { cursor, limit: 10 }, // API max is 10 for trending feed
      );
      return `/api/neynar/feed/trending?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Fetch content from a specific channel with infinite scrolling
 *
 * Retrieves posts published to a specific channel, providing focused content
 * around a particular topic or community. Ideal for channel-specific views
 * and community-driven content discovery.
 *
 * @param channelId - The unique identifier of the channel to retrieve content from
 * @param params - Additional query parameters (see {@link UseChannelFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function ChannelFeed({ channelId }: { channelId: string }) {
 *   const { data, fetchNextPage, hasNextPage } = useChannelFeed(channelId, {
 *     viewer_fid: 123
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useMultiChannelFeed} for combining multiple channels
 * @see {@link useChannelAndChildFeed} for including child channels
 * @see {@link useTrendingFeed} for trending content within a channel
 */
export function useChannelFeed(
  channelId: string,
  params?: UseChannelFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.channel(channelId, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          channelIds: [channelId], // camelCase to match SDK expectation
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/feed/by-channel-ids?${queryParams}`;
    },
    {
      enabled: Boolean(channelId?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Fetch content from a channel and its child channels with infinite scrolling
 *
 * Retrieves posts from both the specified parent channel and all its child channels,
 * providing comprehensive coverage of a channel hierarchy. Useful for topic-based
 * feeds that include related sub-communities.
 *
 * @param channelId - The parent channel identifier to retrieve content from (includes children)
 * @param params - Additional query parameters (see {@link UseChannelAndChildFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function ChannelHierarchyFeed({ channelId }: { channelId: string }) {
 *   const { data, fetchNextPage, hasNextPage } = useChannelAndChildFeed(channelId, {
 *     viewer_fid: 123
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useChannelFeed} for parent channel only (without children)
 * @see {@link useMultiChannelFeed} for specific list of channels
 */
export function useChannelAndChildFeed(
  channelId: string,
  params?: UseChannelAndChildFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.channelAndChild(channelId, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          channelIds: [channelId],
          includeChild: true,
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/feed/by-channel-ids?${queryParams}`;
    },
    {
      enabled: Boolean(channelId?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Fetch content from multiple channels with infinite scrolling
 *
 * Retrieves posts from multiple specified channels in a unified feed, allowing
 * for curated multi-topic content streams. Ideal for dashboard views or
 * custom channel combinations based on user preferences.
 *
 * @param channelIds - Array of channel identifiers to retrieve content from (max: 10 channels)
 * @param params - Additional query parameters (see {@link UseMultiChannelFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function MultiChannelFeed({ channelIds }: { channelIds: string[] }) {
 *   const { data, fetchNextPage, hasNextPage } = useMultiChannelFeed(channelIds, {
 *     viewer_fid: 123
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useChannelFeed} for single channel feed
 * @see {@link useChannelAndChildFeed} for channel hierarchy
 */
export function useMultiChannelFeed(
  channelIds: string[],
  params?: UseMultiChannelFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.multiChannel(channelIds, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          channelIds,
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/feed/by-channel-ids?${queryParams}`;
    },
    {
      enabled: channelIds.length > 0,
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Hook for fetching content related to a specific parent URL with infinite scrolling
 *
 * Retrieves posts that reference or discuss a specific URL, enabling content discovery
 * around external links, articles, or resources. Perfect for tracking conversations
 * about specific web content or building URL-centric discussion feeds.
 *
 * @param url - The parent URL to retrieve related content for
 * @param params - Additional query parameters (see {@link UseParentUrlFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function UrlDiscussion({ url }: { url: string }) {
 *   const { data, fetchNextPage, hasNextPage } = useParentUrlFeed(url, {
 *     viewer_fid: 123
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useFilteredFeed} for more complex filtering options
 */
export function useParentUrlFeed(
  url: string,
  params?: UseParentUrlFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.parentUrl(url, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          parentUrls: [url],
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/feed/by-parent-urls?${queryParams}`;
    },
    {
      enabled: Boolean(url?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Hook for fetching frames-only content feed with infinite scrolling
 *
 * Retrieves posts that contain interactive frames, providing a specialized feed
 * for frame-based content discovery. Frames enable rich interactive experiences
 * within posts, and this feed focuses exclusively on such content.
 *
 * @param params - Additional query parameters (see {@link UseFramesFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function FramesFeed() {
 *   const { data, fetchNextPage, hasNextPage } = useFramesFeed({
 *     viewer_fid: 123,
 *     limit: 50
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useFilteredFeed} for more complex filtering options
 */
export function useFramesFeed(
  params?: UseFramesFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.frames(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/feed/frames-only?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Hook for fetching filtered content feed with infinite scrolling and custom parameters
 *
 * Retrieves posts based on flexible filtering criteria, providing the most versatile
 * feed option with support for complex content discovery needs. This is the general-purpose
 * feed endpoint that can be customized with various filtering parameters.
 *
 * @param params - Additional query parameters (see {@link UseFilteredFeedParams})
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated cast data
 *
 * @example
 * ```tsx
 * function FilteredFeed() {
 *   const { data, fetchNextPage, hasNextPage } = useFilteredFeed({
 *     feed_type: 'filter',
 *     filter_type: 'channel_id',
 *     channel_id: 'warpcast',
 *     viewer_fid: 123,
 *     limit: 100
 *   });
 *   const casts = data?.pages.flatMap(p => p.items) || [];
 *   return <CastList casts={casts} />;
 * }
 * ```
 *
 * @see {@link useFollowingFeed} for simpler following-based feeds
 * @see {@link useChannelFeed} for channel-specific feeds
 * @see {@link useParentUrlFeed} for URL-based feeds
 */
export function useFilteredFeed(
  params?: UseFilteredFeedParams,
  options?: InfiniteQueryHookOptions<FeedResponse, Cast>,
): InfiniteQueryHookResult<Cast> {
  return useApiInfiniteQuery<FeedResponse, InfiniteDataPage<Cast>>(
    neynarQueryKeys.feeds.filtered(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          ...params,
        },
        { cursor, limit: 25 },
      );
      return `/api/neynar/feed?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.FREQUENT,
      refetchOnWindowFocus: false,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.casts || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}
