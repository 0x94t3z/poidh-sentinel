/**
 * Neynar Channel API Hooks
 *
 * React Query hooks for Neynar channel-related operations.
 * Uses TanStack Query v5 with proper error handling and type safety.
 *
 * This module provides comprehensive channel management including:
 * - Channel queries and lookups
 * - Channel search functionality
 * - Channel member and follower management
 * - Channel follow/unfollow operations
 * - Trending and popular channel discovery
 *
 * All hooks follow consistent patterns with proper caching, error handling,
 * and TypeScript safety for robust channel-related functionality.
 */

import {
  useApiQuery,
  useApiMutation,
  useApiInfiniteQuery,
  useApiQueryClient,
  STALE_TIME,
  type ExtendedMutationOptions,
  type InfiniteQueryHookOptions,
  type InfiniteDataPage,
  type InfiniteQueryHookResult,
  type QueryHookOptions,
  type QueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type {
  Channel,
  User,
  ChannelResponse,
  ChannelListResponse,
  ChannelSearchResponse,
  UsersResponse,
  ChannelMemberInviteListResponse,
  ChannelMemberInvite,
} from "../sdk-response-types";

// ============================================================================
// Parameter Types
// ============================================================================

// ============================================================================
// Channel Query Hooks
// ============================================================================

type UseChannelsParams = {
  /** Results per page (default: 20, max: 200) */
  limit?: number;
};

/**
 * Returns a list of all channels with their details
 *
 * @param params - Optional parameters for filtering channels
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated channel data
 *
 * @example
 * ```tsx
 * function ChannelDirectory() {
 *   const { data, fetchNextPage, hasNextPage } = useChannels();
 *   const channels = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {channels.map(channel => (
 *         <div key={channel.id}>
 *           <h3>#{channel.id}</h3>
 *           <p>{channel.description}</p>
 *         </div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannel} for getting a specific channel by ID instead of all channels
 * @see {@link useTrendingChannels} for getting popular channels sorted by activity
 * @see {@link useChannelSearch} for searching channels by name or ID
 */
export function useChannels(
  params?: UseChannelsParams,
  options?: InfiniteQueryHookOptions<ChannelListResponse, Channel>,
): InfiniteQueryHookResult<Channel> {
  return useApiInfiniteQuery<ChannelListResponse, InfiniteDataPage<Channel>>(
    neynarQueryKeys.channels.list(params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {},
        { cursor: cursor || undefined, limit: params?.limit ?? 20 },
      );
      return `/api/neynar/channels?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.STABLE,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page?.channels || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseBulkChannelsParams = {
  /** Type of identifier (default: 'id') */
  type?: "id" | "parent_url";

  /** When provided, adds viewer_context with follow status */
  viewer_fid?: number;
};

/**
 * Fetches details of multiple channels in a single request
 *
 * More performant than making multiple individual requests.
 *
 * **Special Behaviors:**
 * - Array automatically truncated to 100 channels if exceeded (with console warning)
 * - Not paginated (single request only)
 *
 * @param ids - Array of channel IDs or parent URLs to fetch (max: 100, auto-truncated if exceeded)
 * @param params - Optional additional parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with channel data
 *
 * @example
 * ```tsx
 * function ChannelGrid({ channelIds }: { channelIds: string[] }) {
 *   const { data, isLoading, error } = useBulkChannels(channelIds);
 *
 *   if (isLoading) return <div>Loading channels...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data?.length) return <div>No channels found</div>;
 *
 *   return (
 *     <div className="channel-grid">
 *       {data.map(channel => (
 *         <div key={channel.id} className="channel-card">
 *           <img src={channel.image_url} alt={channel.name} />
 *           <h3>#{channel.id}</h3>
 *           <h4>{channel.name}</h4>
 *           <p>{channel.description}</p>
 *           <div className="channel-meta">
 *             <span>{channel.follower_count} followers</span>
 *             <span>Lead: {channel.lead?.display_name}</span>
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannel} for fetching a single channel by ID
 * @see {@link useChannels} for fetching all channels with pagination
 */
export function useBulkChannels(
  ids: string[],
  params?: UseBulkChannelsParams,
  options?: QueryHookOptions<ChannelListResponse, Channel[]>,
): QueryHookResult<Channel[]> {
  // Validate array size limit
  let channelIds = ids;
  if (ids.length > 100) {
    console.warn(
      `useBulkChannels: Maximum 100 channels supported, truncating from ${ids.length} to 100`,
    );
    channelIds = ids.slice(0, 100);
  }

  const queryParams = buildNeynarQuery({
    ids: channelIds,
    ...params,
  });

  return useApiQuery<ChannelListResponse, Channel[]>(
    neynarQueryKeys.channels.byIds(channelIds, params),
    `/api/neynar/channels/bulk?${queryParams}`,
    {
      enabled: channelIds.length > 0,
      staleTime: STALE_TIME.STABLE,
      ...options,
      select: (response) => {
        return response?.channels || [];
      },
    },
  );
}

type UseChannelParams = {
  /** Type of identifier (default: 'id') */
  type?: "id" | "parent_url";

  /** When provided, adds viewer_context with follow status */
  viewer_fid?: number;
};

/**
 * Returns details of a channel
 *
 * @param id - Channel ID or parent_url for the channel
 * @param params - Optional additional parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with channel data
 *
 * @example
 * ```tsx
 * function ChannelHeader({ channelId }: { channelId: string }) {
 *   const { data: channel, isLoading, error } = useChannel(channelId);
 *
 *   if (isLoading) return <div>Loading channel...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!channel) return <div>Channel not found</div>;
 *
 *   return (
 *     <div className="channel-header">
 *       <img src={channel.image_url} alt={channel.name} />
 *       <h1>#{channel.id}</h1>
 *       <h2>{channel.name}</h2>
 *       <p>{channel.description}</p>
 *       <div className="channel-stats">
 *         <span>{channel.follower_count} followers</span>
 *         <span>Lead: {channel.lead?.display_name}</span>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useBulkChannels} for fetching multiple channels at once
 * @see {@link useChannelMembers} for fetching channel members list
 * @see {@link useChannelFollowers} for fetching channel followers list
 */
export function useChannel(
  id: string,
  params?: UseChannelParams,
  options?: QueryHookOptions<ChannelResponse, Channel>,
): QueryHookResult<Channel> {
  const queryParams = buildNeynarQuery({ id, ...params });

  return useApiQuery<ChannelResponse, Channel>(
    neynarQueryKeys.channels.byId(id, params),
    `/api/neynar/channels/lookup?${queryParams}`,
    {
      enabled: Boolean(id?.trim()),
      staleTime: STALE_TIME.STABLE,
      ...options,
      select: (response) => {
        return response?.channel;
      },
    },
  );
}

type UseChannelSearchParams = {
  /** Results per page (default: 20, max: 200) */
  limit?: number;

  /** When provided, adds viewer_context with follow status */
  viewer_fid?: number;
};

/**
 * Returns a list of channels based on ID or name
 *
 * @param query - Channel ID or name for the channel being queried
 * @param params - Optional additional parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated channel data
 *
 * @example
 * ```tsx
 * function ChannelSearch() {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const {
 *     data: searchResults,
 *     isLoading,
 *     error,
 *     fetchNextPage,
 *     hasNextPage
 *   } = useChannelSearch(searchTerm);
 *
 *   return (
 *     <div>
 *       <input
 *         value={searchTerm}
 *         onChange={(e) => setSearchTerm(e.target.value)}
 *         placeholder="Search channels..."
 *       />
 *
 *       {isLoading && <div>Searching...</div>}
 *       {error && <div>Error: {error.message}</div>}
 *
 *       <div className="search-results">
 *         {searchResults?.map(channel => (
 *           <div key={channel.id} className="channel-result">
 *             <h3>#{channel.id} - {channel.name}</h3>
 *             <p>{channel.description}</p>
 *             <span>{channel.follower_count} followers</span>
 *           </div>
 *         ))}
 *       </div>
 *
 *       {hasNextPage && (
 *         <button onClick={() => fetchNextPage()}>Load More Results</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannels} for getting all channels without search filter
 * @see {@link useTrendingChannels} for getting popular channels sorted by activity
 * @see {@link useChannel} for getting a specific channel by exact ID
 */
export function useChannelSearch(
  query: string,
  params?: UseChannelSearchParams,
  options?: InfiniteQueryHookOptions<ChannelSearchResponse, Channel>,
): InfiniteQueryHookResult<Channel> {
  return useApiInfiniteQuery<ChannelSearchResponse, InfiniteDataPage<Channel>>(
    neynarQueryKeys.channels.search(query, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          q: query,
          ...params,
        },
        { cursor, limit: params?.limit ?? 20 },
      );
      return `/api/neynar/channels/search?${queryParams}`;
    },
    {
      enabled: Boolean(query?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page?.channels || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseTrendingChannelsParams = {
  /** Time window for trending calculation (default: '7d') */
  time_window?: "1d" | "7d" | "30d";

  /** Results per page (default: 10, max: 25) */
  limit?: number;
};

/**
 * Returns a list of trending channels based on activity
 *
 * **Special Behaviors:**
 * - Unusual limit: default 10 (most hooks default to 25), max 25
 *
 * @param params - Optional parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated channel data
 *
 * @example
 * ```tsx
 * function TrendingChannels() {
 *   const { data, isLoading, error } = useTrendingChannels({ limit: 10 });
 *
 *   if (isLoading) return <div>Loading trending channels...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!data?.length) return <div>No trending channels found</div>;
 *
 *   return (
 *     <div>
 *       <h2>Trending Channels</h2>
 *       <div className="trending-list">
 *         {data.map((channel, index) => (
 *           <div key={channel.id} className="trending-item">
 *             <span className="rank">#{index + 1}</span>
 *             <img src={channel.image_url} alt={channel.name} />
 *             <div>
 *               <h3>#{channel.id}</h3>
 *               <p>{channel.name}</p>
 *               <span>{channel.follower_count.toLocaleString()} followers</span>
 *             </div>
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannels} for getting all channels without trending sort
 * @see {@link useChannel} for getting specific channel details by ID
 * @see {@link useChannelSearch} for searching channels by name
 */
export function useTrendingChannels(
  params?: UseTrendingChannelsParams,
  options?: InfiniteQueryHookOptions<ChannelListResponse, Channel>,
): InfiniteQueryHookResult<Channel> {
  return useApiInfiniteQuery<ChannelListResponse, InfiniteDataPage<Channel>>(
    neynarQueryKeys.channels.list({ trending: true, ...params }),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          timeWindow: params?.time_window,
          ...params,
        },
        { cursor, limit: params?.limit ?? 10 },
      );
      return `/api/neynar/channels/trending?${queryParams}`;
    },
    {
      staleTime: STALE_TIME.STABLE,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page?.channels || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseChannelMembersParams = {
  /**
   * Enables experimental features (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;

  /** Specify to check if a user is a member without paginating */
  fid?: number;

  /** Results per page (default: 20, max: 100) */
  limit?: number;
};

/**
 * Fetches a list of members in a channel
 *
 * @param channelId - Channel ID for the channel being queried
 * @param params - Optional additional parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated member data
 *
 * @example
 * ```tsx
 * function ChannelMembers({ channelId }: { channelId: string }) {
 *   const {
 *     data: members,
 *     isLoading,
 *     error,
 *     fetchNextPage,
 *     hasNextPage
 *   } = useChannelMembers(channelId);
 *
 *   if (isLoading) return <div>Loading channel members...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Channel Members ({members?.length ?? 0})</h2>
 *       <div className="members-grid">
 *         {members?.map(user => (
 *           <div key={user.fid} className="member-card">
 *             <img src={user.pfp_url} alt={user.display_name} />
 *             <h3>{user.display_name}</h3>
 *             <p>@{user.username}</p>
 *             <span>FID: {user.fid}</span>
 *           </div>
 *         ))}
 *       </div>
 *
 *       {hasNextPage && (
 *         <button onClick={() => fetchNextPage()}>Load More Members</button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannelFollowers} for getting channel followers instead of members
 * @see {@link useChannel} for getting channel metadata and details
 * @see {@link useChannelInvites} for getting channel invite list
 */
export function useChannelMembers(
  channelId: string,
  params?: UseChannelMembersParams,
  options?: InfiniteQueryHookOptions<UsersResponse, User>,
): InfiniteQueryHookResult<User> {
  return useApiInfiniteQuery<UsersResponse, InfiniteDataPage<User>>(
    neynarQueryKeys.channels.members(channelId, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          id: channelId,
          ...params,
        },
        { cursor, limit: params?.limit ?? 20 },
      );
      return `/api/neynar/channels/members?${queryParams}`;
    },
    {
      enabled: Boolean(channelId?.trim()),
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page?.users || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseChannelFollowersParams = {
  /**
   * Enables experimental features (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;

  /** When provided, respects mutes/blocks and adds viewer_context */
  viewer_fid?: number;

  /** Results per page (default: 25, max: 1000) */
  limit?: number;
};

/**
 * Returns a list of followers for a specific channel
 *
 * @param channelId - Channel ID for the channel being queried
 * @param params - Optional additional parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated follower data
 *
 * @example
 * ```tsx
 * function ChannelFollowers({ channelId }: { channelId: string }) {
 *   const {
 *     data: followers,
 *     isLoading,
 *     error,
 *     fetchNextPage,
 *     hasNextPage,
 *     isFetchingNextPage
 *   } = useChannelFollowers(channelId);
 *
 *   if (isLoading) return <div>Loading followers...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Channel Followers ({followers?.length ?? 0})</h2>
 *       <div className="followers-list">
 *         {followers?.map(user => (
 *           <div key={user.fid} className="follower-item">
 *             <img src={user.pfp_url} alt={user.display_name} className="avatar" />
 *             <div className="user-info">
 *               <h4>{user.display_name}</h4>
 *               <p>@{user.username} • FID: {user.fid}</p>
 *               {user.profile?.bio?.text && (
 *                 <p className="bio">{user.profile.bio.text}</p>
 *               )}
 *             </div>
 *           </div>
 *         ))}
 *       </div>
 *
 *       {hasNextPage && (
 *         <button
 *           onClick={() => fetchNextPage()}
 *           disabled={isFetchingNextPage}
 *         >
 *           {isFetchingNextPage ? 'Loading...' : 'Load More Followers'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannelMembers} for getting active channel members instead of followers
 * @see {@link useChannel} for getting channel metadata and details
 * @see {@link useUserFollowers} for getting followers of a user (not channel)
 */
export function useChannelFollowers(
  channelId: string,
  params?: UseChannelFollowersParams,
  options?: InfiniteQueryHookOptions<UsersResponse, User>,
): InfiniteQueryHookResult<User> {
  return useApiInfiniteQuery<UsersResponse, InfiniteDataPage<User>>(
    neynarQueryKeys.channels.followers(channelId, params),
    (cursor) => {
      const queryParams = buildNeynarQuery(
        {
          id: channelId,
          ...params,
        },
        { cursor, limit: params?.limit ?? 25 },
      );
      return `/api/neynar/channels/followers?${queryParams}`;
    },
    {
      enabled: Boolean(channelId?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page?.users || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

type UseChannelInvitesParams = {
  /** Channel ID for the channel being queried */
  channel_id?: string;

  /** FID of the user being invited */
  invited_fid?: number;

  /** Results per request (default: 20, max: 100) */
  limit?: number;
};

/**
 * Fetches a list of invites, either in a channel or for a user
 *
 * If both channel_id and invited_fid are provided, returns open channel invite for that user.
 *
 * **Special Behaviors:**
 * - Not paginated in this hook (returns flat array, though SDK supports pagination)
 *
 * @param params - Query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with invite data
 *
 * @example
 * ```tsx
 * function ChannelInviteManager({ channelId }: { channelId: string }) {
 *   const { data: invites, isLoading, error } = useChannelInvites({ channel_id: channelId });
 *
 *   if (isLoading) return <div>Loading channel invites...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!invites?.length) return <div>No invites</div>;
 *
 *   return (
 *     <div>
 *       <h2>Channel Invites</h2>
 *       <div className="invites-list">
 *         {invites.map(invite => (
 *           <div key={`${invite.invited.fid}-${invite.channel_id}`} className="invite-item">
 *             <div className="inviter">
 *               <img src={invite.inviter.pfp_url} alt={invite.inviter.display_name} />
 *               <span>{invite.inviter.display_name}</span>
 *             </div>
 *             <div className="invite-details">
 *               <p>Invited: {invite.invited.display_name}</p>
 *               <p>Role: {invite.role}</p>
 *             </div>
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannelMembers} for getting current channel members list
 * @see {@link useChannel} for getting channel metadata and details
 */
export function useChannelInvites(
  params?: UseChannelInvitesParams,
  options?: QueryHookOptions<
    ChannelMemberInviteListResponse,
    ChannelMemberInvite[]
  >,
): QueryHookResult<ChannelMemberInvite[]> {
  const queryParams = buildNeynarQuery({
    channelId: params?.channel_id,
    invitedFid: params?.invited_fid,
    limit: params?.limit ?? 20,
  });

  return useApiQuery<ChannelMemberInviteListResponse, ChannelMemberInvite[]>(
    neynarQueryKeys.channels.invites(params?.channel_id || "", params),
    `/api/neynar/channels/invites?${queryParams}`,
    {
      enabled: Boolean(params?.channel_id?.trim() || params?.invited_fid),
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: ChannelMemberInviteListResponse) => {
        // SDK returns: { invites: ChannelMemberInvite[], next?: NextCursor }
        // Extract the invites array from the response
        return response?.invites || [];
      },
    },
  );
}

// ============================================================================
// Channel Mutation Hooks
// ============================================================================

type FollowChannelResponse = {
  /** Whether the follow operation succeeded */
  success: boolean;
};

type FollowChannelParams = {
  /** Channel ID to follow */
  channel_id: string;

  /** Signer UUID for authentication */
  signer_uuid: string;
};

/**
 * Follow a channel
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 *   - `onSuccess?: (data, variables) => void` - Called on successful follow
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result
 *   - `mutate: (params: { channel_id: string, signer_uuid: string }) => void` - Trigger follow operation
 *   - `isPending: boolean` - True while follow is in progress
 *   - `isError: boolean` - True if follow failed
 *   - `error: ApiError | null` - Error if failed
 *   - `isSuccess: boolean` - True if follow succeeded
 *
 * @example
 * ```tsx
 * function FollowChannelButton({ channelId, signerUuid }: {
 *   channelId: string;
 *   signerUuid: string;
 * }) {
 *   const followMutation = useFollowChannel({
 *     onSuccess: () => {
 *       console.log('Successfully followed channel!');
 *       // Additional success handling if needed
 *     },
 *     onError: (error) => {
 *       console.error('Failed to follow channel:', error.message);
 *     }
 *   });
 *
 *   const handleFollow = () => {
 *     followMutation.mutate({
 *       channel_id: channelId,
 *       signer_uuid: signerUuid
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleFollow}
 *       disabled={followMutation.isPending}
 *       className="follow-button"
 *     >
 *       {followMutation.isPending ? 'Following...' : 'Follow Channel'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useUnfollowChannel} for unfollowing a channel
 * @see {@link useChannelFollowers} for getting the list of channel followers
 * @see {@link useFollowUser} for following a user instead of a channel
 */
export function useFollowChannel(
  options?: ExtendedMutationOptions<FollowChannelResponse, FollowChannelParams>,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<FollowChannelResponse, FollowChannelParams>(
    "/api/neynar/channels/follow",
    "POST",
    {
      onSuccess: (_, variables) => {
        // Invalidate channel followers and related queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.channels.followers(variables.channel_id),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.channels.byId(variables.channel_id),
        });
      },
      ...options,
    },
  );
}

type UnfollowChannelParams = {
  /** Channel ID to unfollow */
  channel_id: string;

  /** Signer UUID for authentication */
  signer_uuid: string;
};

/**
 * Unfollow a channel
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 *   - `onSuccess?: (data, variables) => void` - Called on successful unfollow
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result
 *   - `mutate: (params: { channel_id: string, signer_uuid: string }) => void` - Trigger unfollow operation
 *   - `isPending: boolean` - True while unfollow is in progress
 *   - `isError: boolean` - True if unfollow failed
 *   - `error: ApiError | null` - Error if failed
 *   - `isSuccess: boolean` - True if unfollow succeeded
 *
 * @example
 * ```tsx
 * function UnfollowChannelButton({ channelId, signerUuid }: {
 *   channelId: string;
 *   signerUuid: string;
 * }) {
 *   const unfollowMutation = useUnfollowChannel({
 *     onSuccess: () => {
 *       console.log('Successfully unfollowed channel!');
 *       // Additional success handling if needed
 *     },
 *     onError: (error) => {
 *       console.error('Failed to unfollow channel:', error.message);
 *     }
 *   });
 *
 *   const handleUnfollow = () => {
 *     unfollowMutation.mutate({
 *       channel_id: channelId,
 *       signer_uuid: signerUuid
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleUnfollow}
 *       disabled={unfollowMutation.isPending}
 *       className="unfollow-button"
 *     >
 *       {unfollowMutation.isPending ? 'Unfollowing...' : 'Unfollow Channel'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useFollowChannel} for following a channel
 * @see {@link useChannelFollowers} for getting the list of channel followers
 * @see {@link useUnfollowUser} for unfollowing a user instead of a channel
 */
export function useUnfollowChannel(
  options?: ExtendedMutationOptions<
    FollowChannelResponse,
    UnfollowChannelParams
  >,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<FollowChannelResponse, UnfollowChannelParams>(
    "/api/neynar/channels/follow",
    "DELETE",
    {
      onSuccess: (_, variables) => {
        // Invalidate channel followers and related queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.channels.followers(variables.channel_id),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.channels.byId(variables.channel_id),
        });
      },
      ...options,
    },
  );
}
