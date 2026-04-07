/**
 * Neynar User API Hooks
 *
 * React Query hooks for Neynar user-related operations.
 * Uses TanStack Query v5 with proper error handling, type safety, and hierarchical caching.
 *
 * This module provides comprehensive hooks for all user-related Neynar API endpoints,
 * including queries for user data, search functionality, social connections, and mutations
 * for follow/unfollow operations.
 *
 * @example Basic Usage
 * ```tsx
 * import { useUser, useFollowUser } from '@/neynar-web-sdk/api-hooks';
 *
 * function UserProfile({ fid }: { fid: number }) {
 *   const { data: user, isLoading } = useUser(fid);
 *   const followMutation = useFollowUser();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h1>{user?.display_name}</h1>
 *       <button onClick={() => followMutation.mutate({ target_fid: fid, signer_uuid: 'uuid' })}>
 *         Follow
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import {
  useApiQuery,
  useApiMutation,
  useApiInfiniteQuery,
  useApiQueryClient,
  STALE_TIME,
  type QueryHookOptions,
  type QueryHookResult,
  type ExtendedMutationOptions,
  type MutationHookResult,
  type InfiniteQueryHookOptions,
  type InfiniteDataPage,
  type InfiniteQueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type {
  User,
  BulkUsersResponse,
  FollowersResponse,
  Follower,
  UserResponse,
  UserSearchResponse,
  ChannelListResponse,
  Channel,
  BulkUsersByAddressResponse,
} from "../sdk-response-types";

// Mutation parameter types
type FollowParams = {
  target_fid: number;
  signer_uuid: string;
};

// ============================================================================
// User Query Hooks
// ============================================================================

/**
 * Parameters for user query hooks
 *
 * Optional parameters to enhance user data with additional context.
 */
type UseUserParams = {
  /**
   * When provided, adds `viewer_context` to response with relationship status
   * (following, followed_by, blocking, blocked_by)
   */
  viewer_fid?: number;

  /**
   * Enables experimental features including spam score filtering
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;
};

/**
 * Parameters for bulk users query
 */
type UseBulkUsersParams = {
  /**
   * When provided, adds `viewer_context` to each user with relationship status
   */
  viewer_fid?: number;

  /**
   * Enables experimental features including spam score filtering (sent as global header)
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;
};

/**
 * Parameters for user by username query
 */
type UseUserByUsernameParams = {
  /**
   * When provided, adds `viewer_context` to response with relationship status
   */
  viewer_fid?: number;

  /**
   * Enables experimental features including spam score
   * @see {@link https://neynar.notion.site/Experimental-Features-1d2655195a8b80eb98b4d4ae7b76ae4a}
   */
  x_neynar_experimental?: boolean;
};

/**
 * Parameters for user search query
 */
type UseUserSearchParams = {
  /**
   * When provided, adds `viewer_context` to results and respects user's mutes/blocks
   */
  viewer_fid?: number;

  /**
   * Enables experimental features (sent as global header)
   */
  x_neynar_experimental?: boolean;

  /**
   * Results per page (default: 5, max: 10)
   */
  limit?: number;
};

/**
 * Parameters for user followers query
 */
type UseUserFollowersParams = {
  /**
   * When provided, respects mutes/blocks and adds `viewer_context` to each follower's user object
   */
  viewer_fid?: number;

  /**
   * Sort order (default: "desc_chron" - most recent first)
   */
  sort_type?: "desc_chron" | "algorithmic";

  /**
   * Enables experimental features
   */
  x_neynar_experimental?: boolean;

  /**
   * Results per page (default: 20, max: 100)
   */
  limit?: number;
};

/**
 * Parameters for user following query
 */
type UseUserFollowingParams = {
  /**
   * FID of viewing user to get relationship context (adds viewer_context to response)
   */
  viewer_fid?: number;

  /**
   * Sort order: desc_chron (most recent first) or algorithmic (Neynar's algorithm)
   */
  sort_type?: "desc_chron" | "algorithmic";

  /**
   * Enable experimental features including Neynar score filtering
   */
  x_neynar_experimental?: boolean;

  /**
   * Number of results per page (default: 25, max: 100)
   */
  limit?: number;
};

/**
 * Parameters for user active channels query
 */
type UseUserActiveChannelsParams = {
  /**
   * FID of viewing user to get channel relationship context
   */
  viewer_fid?: number;

  /**
   * Maximum number of channels to return (default: 25)
   */
  limit?: number;
};

/**
 * Parameters for bulk users by address query
 */
type UseBulkUsersByAddressParams = {
  /**
   * FID of viewing user to get relationship context
   */
  viewer_fid?: number;
};

/**
 * Fetches information about a user based on FID
 *
 * @param fid - The Farcaster ID of the user to fetch
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with user data
 *
 * @example
 * ```tsx
 * function UserProfile({ fid, viewerFid }: { fid: number; viewerFid?: number }) {
 *   const { data: user } = useUser(fid, { viewer_fid: viewerFid });
 *   return (
 *     <div>
 *       <h1>{user?.display_name}</h1>
 *       <p>@{user?.username} • {user?.follower_count} followers</p>
 *       {user?.viewer_context?.following && <span>Following</span>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useUserByUsername} for fetching by username instead of FID
 * @see {@link useBulkUsers} for fetching multiple users at once
 */
export function useUser(
  fid: number,
  params?: UseUserParams,
  options?: QueryHookOptions<BulkUsersResponse, User>,
): QueryHookResult<User> {
  const queryParams = buildNeynarQuery({
    fids: [fid],
    ...params,
  });

  return useApiQuery<BulkUsersResponse, User>(
    neynarQueryKeys.users.byFid(fid, params),
    `/api/neynar/users/bulk?${queryParams}`,
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: BulkUsersResponse) => {
        // SDK returns: { users: User[] }
        // Extract first user from bulk response
        return response?.users?.[0];
      },
    },
  );
}

/**
 * Fetches information about multiple users based on FIDs
 *
 * Efficiently fetches multiple users in a single API call. More performant than
 * making multiple individual requests.
 *
 * **Special Behaviors:**
 * - Array automatically truncated to 100 FIDs if exceeded (with console warning)
 * - Not paginated (single request only)
 *
 * @param fids - Array of Farcaster IDs to fetch (max: 100, auto-truncated if exceeded)
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with user data
 *
 * @example
 * ```tsx
 * function UserList({ userFids }: { userFids: number[] }) {
 *   const { data: users } = useBulkUsers(userFids);
 *   return <div>{users?.map(user => <div key={user.fid}>{user.display_name}</div>)}</div>;
 * }
 * ```
 *
 * @see {@link useUser} for fetching a single user
 * @see {@link useBulkUsersByAddress} for fetching users by wallet addresses
 */
export function useBulkUsers(
  fids: number[],
  params?: UseBulkUsersParams,
  options?: QueryHookOptions<BulkUsersResponse, User[]>,
): QueryHookResult<User[]> {
  // Validate array size limit from SDK
  if (fids.length > 100) {
    console.warn(
      `useBulkUsers: fids array exceeds maximum of 100 (got ${fids.length}). Truncating to first 100.`,
    );
    fids = fids.slice(0, 100);
  }

  const queryParams = buildNeynarQuery({
    fids,
    ...params,
  });

  return useApiQuery<BulkUsersResponse, User[]>(
    neynarQueryKeys.users.bulk(fids, params),
    `/api/neynar/users/bulk?${queryParams}`,
    {
      enabled: fids.length > 0,
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: BulkUsersResponse) => {
        // SDK returns: { users: User[] }
        // Extract users array from response
        return response?.users || [];
      },
    },
  );
}

/**
 * Get a user by their username
 *
 * Fetches detailed user information using a username (handle). See USER TYPE REFERENCE
 * above for complete User object structure.
 *
 * **Special Behaviors:**
 * - Username lookup is case-insensitive
 * - '@' prefix is automatically stripped if provided
 *
 * @param username - The username (with or without @) of the user to fetch
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with user data
 *
 * @example
 * ```tsx
 * function UserProfile({ username }: { username: string }) {
 *   const { data: user } = useUserByUsername(username);
 *   return <div>{user?.display_name} (@{user?.username})</div>;
 * }
 * ```
 *
 * @see {@link useUser} for fetching by FID instead of username
 * @see {@link useUserSearch} for searching across multiple users
 */
export function useUserByUsername(
  username: string,
  params?: UseUserByUsernameParams,
  options?: QueryHookOptions<UserResponse, User>,
): QueryHookResult<User> {
  const queryParams = buildNeynarQuery({
    username,
    ...params,
  });

  return useApiQuery<UserResponse, User>(
    neynarQueryKeys.users.byUsername(username, params),
    `/api/neynar/users/by-username?${queryParams}`,
    {
      enabled: Boolean(username?.trim()),
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: UserResponse) => {
        // SDK returns: { user: User }
        // Extract single user from response
        return response?.user;
      },
    },
  );
}

/**
 * Search users by display name or username with infinite scroll
 *
 * Searches across usernames and display names with pagination support.
 * See USER TYPE REFERENCE above for User structure.
 *
 * **Special Behaviors:**
 * - Query automatically disabled if search string is empty/whitespace
 * - Unusual pagination: default limit is 5 (not 25), max is 10
 *
 * @param query - Search query string to match against usernames and display names
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated user search results
 *
 * @example
 * ```tsx
 * function UserSearch() {
 *   const [query, setQuery] = useState('');
 *   const { data, fetchNextPage, hasNextPage } = useUserSearch(query);
 *   const users = data?.pages.flatMap(page => page.items) || [];
 *   return (
 *     <div>
 *       <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *       {users.map(user => <div key={user.fid}>{user.display_name}</div>)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useUserByUsername} for exact username lookups
 */
export function useUserSearch(
  query: string,
  params?: UseUserSearchParams,
  options?: InfiniteQueryHookOptions<UserSearchResponse, User>,
): InfiniteQueryHookResult<User> {
  return useApiInfiniteQuery<UserSearchResponse, InfiniteDataPage<User>>(
    neynarQueryKeys.users.search(query, params),
    (cursor) => {
      const { limit, ...restParams } = params || {};
      const paginationOptions: { cursor: string | null; limit?: number } = {
        cursor,
      };
      if (typeof limit === "number") {
        paginationOptions.limit = limit;
      }
      const queryParams = buildNeynarQuery(
        { q: query, ...restParams },
        paginationOptions,
      );
      return `/api/neynar/users/search?${queryParams}`;
    },
    {
      enabled: Boolean(query?.trim()),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: UserSearchResponse) => ({
          items: page?.result?.users || [],
          nextCursor: page?.result?.next?.cursor || null,
          hasNextPage: Boolean(page?.result?.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Get user followers with infinite scroll pagination
 *
 * Fetches users who follow the specified user. Each follower object contains
 * a complete User object (see USER TYPE REFERENCE above).
 *
 * @param fid - The Farcaster ID of the user whose followers to fetch
 * @param params - Additional query parameters
 * @param options - TanStack Query options for caching and pagination behavior
 * @returns TanStack Query infinite result with paginated follower data
 *
 * @example
 * ```tsx
 * function UserFollowers({ fid }: { fid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useUserFollowers(fid);
 *   const followers = data?.pages.flatMap(page => page.items) || [];
 *   return (
 *     <div>
 *       {followers.map(follower => <div key={follower.user.fid}>{follower.user.display_name}</div>)}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useUserFollowing} for users that this user follows
 */
export function useUserFollowers(
  fid: number,
  params?: UseUserFollowersParams,
  options?: InfiniteQueryHookOptions<FollowersResponse, Follower>,
): InfiniteQueryHookResult<Follower> {
  return useApiInfiniteQuery<FollowersResponse, InfiniteDataPage<Follower>>(
    neynarQueryKeys.users.followers(fid, params),
    (cursor) => {
      const { limit, ...restParams } = params || {};
      const paginationOptions: { cursor: string | null; limit?: number } = {
        cursor,
      };
      if (typeof limit === "number") {
        paginationOptions.limit = limit;
      }
      const queryParams = buildNeynarQuery(restParams, paginationOptions);
      return `/api/neynar/v2/user/${fid}/followers?${queryParams}`;
    },
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.users || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Get users that a user is following with infinite scroll pagination
 *
 * Fetches users that the specified user follows with TanStack Query infinite scroll support.
 * Results are paginated and can be loaded incrementally as needed. Includes viewer context
 * for relationship information when available.
 *
 * @param fid - The Farcaster ID of the user whose following list to fetch
 * @param params - Additional query parameters for filtering and viewer context
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query infinite result with paginated following data
 *
 * @example Basic following list with infinite scroll
 * ```tsx
 * function UserFollowing({ fid }: { fid: number }) {
 *   const {
 *     data,
 *     isLoading,
 *     error,
 *     fetchNextPage,
 *     hasNextPage,
 *     isFetchingNextPage
 *   } = useUserFollowing(fid);
 *
 *   if (isLoading) return <div>Loading following...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const following = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       <h2>Following ({following.length}+)</h2>
 *       {following.map(follower => (
 *         <div key={follower.user.fid}>
 *           <img src={follower.user.pfp_url} alt={follower.user.display_name} />
 *           <div>
 *             <h3>{follower.user.display_name}</h3>
 *             <p>@{follower.user.username} • {follower.user.follower_count} followers</p>
 *           </div>
 *         </div>
 *       ))}
 *
 *       {hasNextPage && (
 *         <button
 *           onClick={() => fetchNextPage()}
 *           disabled={isFetchingNextPage}
 *         >
 *           {isFetchingNextPage ? 'Loading...' : 'Load More'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Following list with relationship indicators
 * ```tsx
 * function FollowingWithRelationships({ fid, viewerFid }: { fid: number; viewerFid?: number }) {
 *   const { data } = useUserFollowing(fid, { viewer_fid: viewerFid });
 *   const following = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       {following.map(follower => (
 *         <div key={follower.user.fid}>
 *           <h4>{follower.user.display_name} (@{follower.user.username})</h4>
 *           <div>
 *             {follower.user.viewer_context?.following && (
 *               <span>You follow</span>
 *             )}
 *             {follower.user.viewer_context?.followed_by && (
 *               <span>Follows you</span>
 *             )}
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Following list with algorithmic sorting
 * ```tsx
 * function AlgorithmicFollowing({ fid }: { fid: number }) {
 *   const { data } = useUserFollowing(
 *     fid,
 *     {
 *       sort_type: 'algorithmic',
 *       x_neynar_experimental: true
 *     }
 *   );
 *   const following = data?.pages.flatMap(page => page.items) || [];
 *
 *   return (
 *     <div>
 *       <h2>Top Following (Algorithmic)</h2>
 *       {following.map(follower => (
 *         <div key={follower.user.fid}>{follower.user.display_name}</div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useUserFollowers} for users that follow this user
 * @see {@link useUser} for getting detailed user information
 */
export function useUserFollowing(
  fid: number,
  params?: UseUserFollowingParams,
  options?: InfiniteQueryHookOptions<FollowersResponse, Follower>,
): InfiniteQueryHookResult<Follower> {
  return useApiInfiniteQuery<FollowersResponse, InfiniteDataPage<Follower>>(
    neynarQueryKeys.users.following(fid, params),
    (cursor) => {
      const { limit, ...restParams } = params || {};
      const paginationOptions: { cursor: string | null; limit?: number } = {
        cursor,
      };
      if (typeof limit === "number") {
        paginationOptions.limit = limit;
      }
      const queryParams = buildNeynarQuery(restParams, paginationOptions);
      return `/api/neynar/v2/user/${fid}/following?${queryParams}`;
    },
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page) => ({
          items: page.users || [],
          nextCursor: page.next?.cursor || null,
          hasNextPage: Boolean(page.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Get user's active channels
 *
 * Fetches channels where the user is actively participating, either as a member,
 * moderator, or frequent contributor. This provides insight into the user's community
 * involvement and interests within the Farcaster ecosystem.
 *
 * @param fid - The Farcaster ID of the user whose active channels to fetch
 * @param params - Additional query parameters for filtering and viewer context
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query infinite result with paginated channel data
 *
 * @example Basic active channels display
 * ```tsx
 * function UserChannels({ fid }: { fid: number }) {
 *   const { data: channels, isLoading, error } = useUserActiveChannels(fid);
 *
 *   if (isLoading) return <div>Loading channels...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!channels?.length) return <div>No active channels</div>;
 *
 *   return (
 *     <div>
 *       <h3>Active Channels</h3>
 *       {channels.map(channel => (
 *         <div key={channel.id}>
 *           <img src={channel.image_url} alt={channel.name} />
 *           <div>
 *             <h4>{channel.name}</h4>
 *             <p>{channel.description}</p>
 *             <span>{channel.follower_count} followers</span>
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Channels with membership status
 * ```tsx
 * function UserChannelsWithMembership({ fid, viewerFid }: { fid: number; viewerFid?: number }) {
 *   const { data: channels } = useUserActiveChannels(fid, { viewer_fid: viewerFid });
 *
 *   return (
 *     <div>
 *       <h3>Communities</h3>
 *       {channels?.map(channel => (
 *         <div key={channel.id}>
 *           <h4>{channel.name}</h4>
 *           <p>{channel.description}</p>
 *           {channel.viewer_context?.following && (
 *             <span>You're also a member</span>
 *           )}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useChannelByIds} from channel hooks for detailed channel information
 */
export function useUserActiveChannels(
  fid: number,
  params?: UseUserActiveChannelsParams,
  options?: InfiniteQueryHookOptions<ChannelListResponse, Channel>,
): InfiniteQueryHookResult<Channel> {
  return useApiInfiniteQuery<ChannelListResponse, InfiniteDataPage<Channel>>(
    neynarQueryKeys.users.activeChannels(fid, params),
    (cursor) => {
      const { limit, ...restParams } = params || {};
      const paginationOptions: { cursor: string | null; limit?: number } = {
        cursor,
      };
      if (typeof limit === "number") {
        paginationOptions.limit = limit;
      }
      const queryParams = buildNeynarQuery(
        { fid, ...restParams },
        paginationOptions,
      );
      return `/api/neynar/users/channels?${queryParams}`;
    },
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (data) => ({
        pages: data.pages.map((page: ChannelListResponse) => ({
          items: page?.channels || [],
          nextCursor: page?.next?.cursor || null,
          hasNextPage: Boolean(page?.next?.cursor),
        })),
        pageParams: data.pageParams,
      }),
    },
  );
}

/**
 * Get users by their wallet addresses
 *
 * Efficiently fetches users associated with cryptocurrency wallet addresses.
 * Supports multiple address types including Ethereum addresses, ENS domains,
 * and other blockchain addresses. Useful for wallet-based user discovery.
 *
 * @param addresses - Array of wallet addresses to look up (supports various formats including 0x, ENS, .sol)
 * @param addressTypes - Optional array specifying address types (e.g., ['ethereum', 'solana'])
 * @param params - Additional query parameters for filtering and viewer context
 * @param options - Additional query options for caching and request behavior
 * @returns TanStack Query result containing array of user data
 *
 * @example Basic wallet-based user lookup
 * ```tsx
 * function WalletUsers() {
 *   const walletAddresses = [
 *     '0x8E9bFa938E3631B9351A83DdA88C1f89d79E7585',
 *     '0x742aBb4b2B3bd86D3dB2E9e6f7f0Fe7b98E5D2a1'
 *   ];
 *
 *   const { data: users, isLoading, error } = useBulkUsersByAddress(walletAddresses);
 *
 *   if (isLoading) return <div>Looking up wallet owners...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!users?.length) return <div>No users found for these addresses</div>;
 *
 *   return (
 *     <div>
 *       <h2>Wallet Owners</h2>
 *       {users.map(user => (
 *         <div key={user.fid}>
 *           <h3>{user.display_name} (@{user.username})</h3>
 *           <p>FID: {user.fid}</p>
 *           {user.verified_addresses?.eth_addresses?.map(address => (
 *             <code key={address}>{address}</code>
 *           ))}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With specific address types and viewer context
 * ```tsx
 * function EthereumUsers({ addresses, viewerFid }: {
 *   addresses: string[];
 *   viewerFid?: number;
 * }) {
 *   const { data: users } = useBulkUsersByAddress(
 *     addresses,
 *     ['ethereum'], // Only look for Ethereum addresses
 *     { viewer_fid: viewerFid }
 *   );
 *
 *   return (
 *     <div>
 *       {users?.map(user => (
 *         <div key={user.fid}>
 *           <h4>{user.display_name}</h4>
 *           <div>
 *             {user.verified_addresses?.eth_addresses?.map(addr => (
 *               <div key={addr}>
 *                 <code>{addr.slice(0, 6)}...{addr.slice(-4)}</code>
 *                 {user.viewer_context?.following && <span>Following</span>}
 *               </div>
 *             ))}
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useBulkUsers} for fetching users by FIDs instead
 * @see {@link useUser} for getting detailed single user information
 */
export function useBulkUsersByAddress(
  addresses: string[],
  addressTypes?: string[],
  params?: UseBulkUsersByAddressParams,
  options?: QueryHookOptions<BulkUsersByAddressResponse, User[]>,
): QueryHookResult<User[]> {
  const queryParams = buildNeynarQuery({
    addresses,
    ...(addressTypes && { address_types: addressTypes }),
    ...params,
  });

  return useApiQuery<BulkUsersByAddressResponse, User[]>(
    neynarQueryKeys.users.bulkByAddress(addresses, addressTypes, params),
    `/api/neynar/users/bulk-by-address?${queryParams}`,
    {
      enabled: addresses.length > 0,
      staleTime: STALE_TIME.NORMAL,
      ...options,
      select: (response: BulkUsersByAddressResponse) => {
        // SDK returns: { [address: string]: User[] }
        // Flatten all users from all addresses into a single array
        return Object.values(response || {}).flat();
      },
    },
  );
}

// ============================================================================
// User Mutation Hooks
// ============================================================================

/**
 * Follow a user mutation hook
 *
 * Provides a mutation function to follow a user on Farcaster. Automatically
 * invalidates related queries to keep the UI in sync. Requires a signer UUID
 * for authentication and the target user's FID.
 *
 * @param options - Additional mutation options for error handling and callbacks
 *   - `onSuccess?: (data, variables) => void` - Called on successful follow
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result with mutate function and state
 *   - `mutate: (params: { target_fid: number, signer_uuid: string }) => void` - Trigger follow
 *   - `isPending: boolean` - True while follow is in progress
 *   - `isError: boolean` - True if follow failed
 *   - `error: ApiError | null` - Error if failed
 *   - `isSuccess: boolean` - True if follow succeeded
 *
 * **Mutation Parameters:**
 * ```typescript
 * {
 *   target_fid: number;             // FID of user to follow
 *   signer_uuid: string;            // Signer UUID for authentication
 * }
 * ```
 *
 * @example Basic follow functionality
 * ```tsx
 * function FollowButton({ targetFid, signerUuid }: {
 *   targetFid: number;
 *   signerUuid: string;
 * }) {
 *   const followMutation = useFollowUser({
 *     onSuccess: () => {
 *       console.log('Successfully followed user!');
 *       // UI will automatically update due to query invalidation
 *     },
 *     onError: (error) => {
 *       console.error('Failed to follow user:', error);
 *       alert(`Error: ${error.message}`);
 *     }
 *   });
 *
 *   const handleFollow = () => {
 *     followMutation.mutate({
 *       target_fid: targetFid,
 *       signer_uuid: signerUuid
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleFollow}
 *       disabled={followMutation.isPending}
 *     >
 *       {followMutation.isPending ? 'Following...' : 'Follow'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @example Follow with optimistic updates
 * ```tsx
 * function OptimisticFollowButton({ user, signerUuid }: {
 *   user: User;
 *   signerUuid: string;
 * }) {
 *   const [isOptimisticallyFollowing, setOptimisticallyFollowing] = useState(false);
 *   const followMutation = useFollowUser({
 *     onMutate: () => {
 *       setOptimisticallyFollowing(true);
 *     },
 *     onSuccess: () => {
 *       // Keep optimistic state until queries refetch
 *     },
 *     onError: () => {
 *       setOptimisticallyFollowing(false);
 *     }
 *   });
 *
 *   const isFollowing = user.viewer_context?.following || isOptimisticallyFollowing;
 *   const isPending = followMutation.isPending;
 *
 *   return (
 *     <button
 *       onClick={() => followMutation.mutate({
 *         target_fid: user.fid,
 *         signer_uuid: signerUuid
 *       })}
 *       disabled={isPending || isFollowing}
 *     >
 *       {isPending ? 'Following...' : isFollowing ? 'Following' : 'Follow'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useUnfollowUser} for unfollowing users
 * @see {@link useUser} for getting updated user information after following
 */
export function useFollowUser(
  options?: ExtendedMutationOptions<unknown, FollowParams>,
): MutationHookResult<unknown, FollowParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<unknown, FollowParams>(
    "/api/neynar/users/follow",
    "POST",
    {
      onSuccess: (_, variables) => {
        // Invalidate related queries using hierarchical keys
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.followers(variables.target_fid),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.following(variables.target_fid),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.all(),
        });
      },
      ...options,
    },
  );
}

/**
 * Unfollow a user mutation hook
 *
 * Provides a mutation function to unfollow a user on Farcaster. Automatically
 * invalidates related queries to keep the UI in sync. Requires a signer UUID
 * for authentication and the target user's FID.
 *
 * @param options - Additional mutation options for error handling and callbacks
 *   - `onSuccess?: (data, variables) => void` - Called on successful unfollow
 *   - `onError?: (error) => void` - Called on error
 *   - `onMutate?: (variables) => void` - Called before mutation starts
 * @returns TanStack Query mutation result with mutate function and state
 *   - `mutate: (params: { target_fid: number, signer_uuid: string }) => void` - Trigger unfollow
 *   - `isPending: boolean` - True while unfollow is in progress
 *   - `isError: boolean` - True if unfollow failed
 *   - `error: ApiError | null` - Error if failed
 *   - `isSuccess: boolean` - True if unfollow succeeded
 *
 * **Mutation Parameters:**
 * ```typescript
 * {
 *   target_fid: number;             // FID of user to unfollow
 *   signer_uuid: string;            // Signer UUID for authentication
 * }
 * ```
 *
 * @example Basic unfollow functionality
 * ```tsx
 * function UnfollowButton({ targetFid, signerUuid }: {
 *   targetFid: number;
 *   signerUuid: string;
 * }) {
 *   const unfollowMutation = useUnfollowUser({
 *     onSuccess: () => {
 *       console.log('Successfully unfollowed user!');
 *       // UI will automatically update due to query invalidation
 *     },
 *     onError: (error) => {
 *       console.error('Failed to unfollow user:', error);
 *       alert(`Error: ${error.message}`);
 *     }
 *   });
 *
 *   const handleUnfollow = () => {
 *     unfollowMutation.mutate({
 *       target_fid: targetFid,
 *       signer_uuid: signerUuid
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleUnfollow}
 *       disabled={unfollowMutation.isPending}
 *       className="text-red-600"
 *     >
 *       {unfollowMutation.isPending ? 'Unfollowing...' : 'Unfollow'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @example Combined follow/unfollow toggle button
 * ```tsx
 * function FollowToggleButton({ user, signerUuid }: {
 *   user: User;
 *   signerUuid: string;
 * }) {
 *   const followMutation = useFollowUser();
 *   const unfollowMutation = useUnfollowUser();
 *
 *   const isFollowing = user.viewer_context?.following;
 *   const isPending = followMutation.isPending || unfollowMutation.isPending;
 *
 *   const handleToggle = () => {
 *     const mutation = isFollowing ? unfollowMutation : followMutation;
 *     mutation.mutate({
 *       target_fid: user.fid,
 *       signer_uuid: signerUuid
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleToggle}
 *       disabled={isPending}
 *       className={isFollowing ? 'bg-gray-200' : 'bg-blue-500 text-white'}
 *     >
 *       {isPending
 *         ? (isFollowing ? 'Unfollowing...' : 'Following...')
 *         : (isFollowing ? 'Following' : 'Follow')
 *       }
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useFollowUser} for following users
 * @see {@link useUser} for getting updated user information after unfollowing
 */
export function useUnfollowUser(
  options?: ExtendedMutationOptions<unknown, FollowParams>,
): MutationHookResult<unknown, FollowParams> {
  const queryClient = useApiQueryClient();

  return useApiMutation<unknown, FollowParams>(
    "/api/neynar/users/follow",
    "DELETE",
    {
      onSuccess: (_, variables) => {
        // Invalidate related queries
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.followers(variables.target_fid),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.following(variables.target_fid),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.users.all(),
        });
      },
      ...options,
    },
  );
}
