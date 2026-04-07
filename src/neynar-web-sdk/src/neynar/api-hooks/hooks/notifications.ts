/**
 * Neynar Notifications API hooks
 *
 * Comprehensive set of hooks for managing user notifications, channel notifications,
 * and notification campaigns. Provides real-time notification fetching with proper
 * cache invalidation and hierarchical query key management.
 */

import {
  useApiQuery,
  useApiMutation,
  useApiQueryClient,
  useApiInfiniteQuery,
  STALE_TIME,
  type ExtendedMutationOptions,
  type ExtendedQueryOptions,
  type InfiniteQueryHookResult,
  type InfiniteDataPage,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type { Notification } from "../sdk-response-types";

// ============================================================================
// Parameter Types
// ============================================================================

type MarkNotificationsSeenParams = {
  signer_uuid?: string;
  type?: "follows" | "recasts" | "likes" | "mentions" | "replies" | "quotes";
};

type UseNotificationsParams = {
  /**
   * Notification type to fetch (comma separated values)
   */
  type?: Array<
    "follows" | "recasts" | "likes" | "mentions" | "replies" | "quotes"
  >;

  /**
   * Enables experimental features including filtering based on the Neynar score (sent as global header)
   */
  x_neynar_experimental?: boolean;

  /**
   * Number of results to fetch (default: 15, max: 25)
   */
  limit?: number;
};

/**
 * Returns a list of notifications for a specific FID
 *
 * Fetches notifications for a user with infinite scroll pagination. The response
 * respects the user's mutes and blocks. Supports filtering by notification type
 * and experimental features for enhanced ranking.
 *
 * @param fid - FID of the user to fetch notifications for
 * @param params - Additional query parameters
 * @returns TanStack Query infinite result with paginated notification data
 *
 * @example
 * ```tsx
 * function NotificationsList({ fid }: { fid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useNotifications(fid);
 *   const notifications = data?.pages.flatMap(page => page.items) || [];
 *   return (
 *     <div>
 *       {notifications.map((notif, i) => (
 *         <div key={i}>{notif.type}</div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useNotificationsByParentUrl} for notifications in specific parent URLs (Frames, external content)
 * @see {@link useChannelNotifications} for notifications in specific channels
 * @see {@link useMarkNotificationsAsSeen} for marking notifications as seen
 */
export function useNotifications(
  fid?: number,
  params?: UseNotificationsParams,
): InfiniteQueryHookResult<Notification> {
  return useApiInfiniteQuery<
    { notifications: Notification[]; next: { cursor?: string } },
    InfiniteDataPage<Notification>
  >(
    neynarQueryKeys.notifications.byUser(fid || 0, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        { fid, ...params },
        { cursor, limit: params?.limit ?? 15 },
      );
      return `/api/neynar/notifications?${queryParams}`;
    },
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.REALTIME,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.notifications || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseNotificationsByParentUrlParams = {
  /**
   * Enables experimental features including filtering based on the Neynar score (sent as global header)
   */
  x_neynar_experimental?: boolean;

  /**
   * Number of results to fetch (default: 15, max: 25)
   */
  limit?: number;
};

/**
 * Returns a list of notifications for a user in specific parent_urls
 *
 * Retrieves notifications related to specific parent URLs with infinite scroll
 * pagination. Useful for tracking activity in Frames, external content, or app URLs.
 * The response respects the user's mutes and blocks.
 *
 * @param fid - FID of the user to fetch notifications for
 * @param parentUrls - Parent URL(s) to filter by (comma separated for multiple URLs)
 * @param params - Additional query parameters
 * @returns TanStack Query infinite result with paginated notification data
 *
 * @example
 * ```tsx
 * function FrameNotifications({ fid, frameUrl }: { fid: number; frameUrl: string }) {
 *   const { data, fetchNextPage, hasNextPage } = useNotificationsByParentUrl(fid, frameUrl);
 *   const notifications = data?.pages.flatMap(page => page.items) || [];
 *   return (
 *     <div>
 *       <h3>Frame Activity</h3>
 *       {notifications.map((notif, index) => (
 *         <div key={index}>{notif.type}</div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useNotifications} for all notifications across all contexts
 * @see {@link useChannelNotifications} for notifications in specific channels
 */
export function useNotificationsByParentUrl(
  fid: number,
  parentUrls: string,
  params?: UseNotificationsByParentUrlParams,
): InfiniteQueryHookResult<Notification> {
  return useApiInfiniteQuery<
    { notifications: Notification[]; next: { cursor?: string } },
    InfiniteDataPage<Notification>
  >(
    neynarQueryKeys.notifications.byParentUrl(parentUrls, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        { fid, parent_url: parentUrls, ...params },
        { cursor, limit: params?.limit ?? 15 },
      );
      return `/api/neynar/notifications/by-parent-url?${queryParams}`;
    },
    {
      enabled: Boolean(fid) && Boolean(parentUrls?.trim()),
      staleTime: STALE_TIME.REALTIME,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.notifications || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseChannelNotificationsParams = {
  /**
   * Enables experimental features including filtering based on the Neynar score (sent as global header)
   */
  x_neynar_experimental?: boolean;

  /**
   * Number of results to fetch (default: 15, max: 25)
   */
  limit?: number;
};

/**
 * Returns a list of notifications for a user in specific channels
 *
 * Retrieves notifications related to specific channels with infinite scroll
 * pagination. Useful for tracking activity in channels the user follows or moderates.
 * The response respects the user's mutes and blocks.
 *
 * @param fid - FID of the user to fetch notifications for
 * @param channelIds - Channel ID(s) to filter by (comma separated for multiple channels)
 * @param params - Additional query parameters
 * @returns TanStack Query infinite result with paginated notification data
 *
 * @example
 * ```tsx
 * function ChannelNotifications({ fid, channelId }: { fid: number; channelId: string }) {
 *   const { data, fetchNextPage, hasNextPage } = useChannelNotifications(fid, channelId);
 *   const notifications = data?.pages.flatMap(page => page.items) || [];
 *   return (
 *     <div>
 *       <h3>Channel Activity</h3>
 *       {notifications.map((notif, index) => (
 *         <div key={index}>{notif.type}</div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useNotifications} for all notifications across all contexts
 * @see {@link useNotificationsByParentUrl} for notifications in specific parent URLs
 */
export function useChannelNotifications(
  fid: number,
  channelIds: string,
  params?: UseChannelNotificationsParams,
): InfiniteQueryHookResult<Notification> {
  return useApiInfiniteQuery<
    { notifications: Notification[]; next: { cursor?: string } },
    InfiniteDataPage<Notification>
  >(
    neynarQueryKeys.notifications.byChannel(channelIds, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        { fid, channel_ids: channelIds, ...params },
        { cursor, limit: params?.limit ?? 15 },
      );
      return `/api/neynar/notifications/channel?${queryParams}`;
    },
    {
      enabled: Boolean(fid) && Boolean(channelIds?.trim()),
      staleTime: STALE_TIME.REALTIME,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.notifications || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Mark notifications as seen mutation hook
 *
 * Provides a mutation function to mark notifications as seen/read. Automatically
 * invalidates all notification queries to keep the UI in sync. Supports marking
 * all notifications or filtering by specific notification type.
 *
 * **Authorization Methods:**
 * 1. Provide a valid signer_uuid in the request body (most common)
 * 2. Provide a valid, signed "Bearer" token in the request's Authorization header
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 *   - `onSuccess?: (data, variables) => void` - Called on successful update
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result
 *   - `mutate: (params: { signer_uuid?: string, type?: string }) => void` - Trigger mark as seen
 *   - `isPending: boolean` - True while update is in progress
 *   - `isError: boolean` - True if update failed
 *   - `error: ApiError | null` - Error if failed
 *   - `isSuccess: boolean` - True if update succeeded
 *
 * **Mutation Parameters:**
 * ```typescript
 * {
 *   signer_uuid?: string;  // UUID of signer with write permission (required unless Bearer token provided)
 *   type?: "follows" | "recasts" | "likes" | "mentions" | "replies" | "quotes";  // Notification type (if omitted, all marked as seen)
 * }
 * ```
 *
 * @example
 * ```tsx
 * function NotificationCenter({ signerUuid }: { signerUuid: string }) {
 *   const markSeenMutation = useMarkNotificationsAsSeen();
 *
 *   const handleMarkAllRead = () => {
 *     markSeenMutation.mutate({ signer_uuid: signerUuid });
 *   };
 *
 *   return (
 *     <button onClick={handleMarkAllRead} disabled={markSeenMutation.isPending}>
 *       Mark All Read
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useNotifications} for fetching notifications
 * @see {@link useNotificationsByParentUrl} for parent URL-specific notifications
 * @see {@link useChannelNotifications} for channel-specific notifications
 */
export function useMarkNotificationsAsSeen(
  options?: ExtendedMutationOptions<unknown, MarkNotificationsSeenParams>,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<unknown, MarkNotificationsSeenParams>(
    "/api/neynar/notifications/seen",
    "PUT",
    {
      onSuccess: () => {
        // Invalidate all notification queries using hierarchical keys
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.notifications.all(),
        });
      },
      ...options,
    },
  );
}

type UseNotificationCampaignStatsParams = {
  /**
   * The number of results to return (default: 100, max: 1000)
   */
  limit?: number;

  /**
   * Pagination cursor
   */
  cursor?: string;
};

/**
 * Retrieve notification delivery and opened stats for notification campaigns
 *
 * Fetches delivery and engagement statistics for notification campaigns. Can retrieve
 * stats for a specific campaign or all campaigns. Useful for tracking notification
 * campaign performance and user engagement metrics.
 *
 * @param campaignId - An ID of a specific notification campaign to query (optional - if omitted, returns stats for all campaigns)
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with campaign statistics
 *
 * @example
 * ```tsx
 * function CampaignStats({ campaignId }: { campaignId: string }) {
 *   const { data, isLoading } = useNotificationCampaignStats(campaignId);
 *   if (isLoading) return <div>Loading...</div>;
 *   return <div>{JSON.stringify(data)}</div>;
 * }
 * ```
 *
 * @see {@link useNotifications} for fetching user notifications
 * @see {@link useMarkNotificationsAsSeen} for marking notifications as seen
 */
export function useNotificationCampaignStats(
  campaignId?: string,
  params?: UseNotificationCampaignStatsParams,
  options?: ExtendedQueryOptions<unknown>,
) {
  const queryParams = buildNeynarQuery({
    ...(campaignId && { campaign_id: campaignId }),
    ...params,
  });

  return useApiQuery<unknown>(
    neynarQueryKeys.notifications.campaignStats(campaignId, params),
    `/api/neynar/notifications/campaign/stats?${queryParams}`,
    {
      staleTime: STALE_TIME.FREQUENT,
      ...options,
    },
  );
}
