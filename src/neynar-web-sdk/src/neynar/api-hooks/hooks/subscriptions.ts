/**
 * Neynar Subscriptions API Hooks
 *
 * React Query hooks for Neynar subscription-related operations.
 * Uses TanStack Query v5 with proper error handling, type safety, and hierarchical caching.
 *
 * This module provides comprehensive hooks for subscription management including:
 * - Querying users subscribed to
 * - Fetching subscriber lists
 * - Checking subscription status for STP contracts
 * - Managing created subscriptions
 *
 * All hooks support infinite pagination where applicable and include proper viewer context
 * for personalized subscription states.
 *
 * @example Basic Usage
 * ```tsx
 * import { useSubscribers, useSubscriptionCheck } from '@/neynar-web-sdk/api-hooks';
 *
 * function SubscriberList({ fid, viewerFid }: { fid: number; viewerFid: number }) {
 *   const { data, fetchNextPage, hasNextPage } = useSubscribers({
 *     fid,
 *     viewer_fid: viewerFid,
 *     subscription_provider: 'fabric_stp'
 *   });
 *
 *   const subscribers = data?.pages.flatMap(p => p.items) || [];
 *
 *   return (
 *     <div>
 *       <h2>Subscribers ({subscribers.length})</h2>
 *       {subscribers.map(sub => (
 *         <div key={sub.fid}>{sub.display_name}</div>
 *       ))}
 *       {hasNextPage && <button onClick={() => fetchNextPage()}>Load More</button>}
 *     </div>
 *   );
 * }
 * ```
 */

import {
  useApiQuery,
  STALE_TIME,
  type QueryHookOptions,
  type QueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
// Subscription parameter types
type SubscriptionProvider = "fabric_stp" | "paragraph";
import type {
  SubscribedToResponse,
  SubscribedTo,
  SubscribersResponse,
  Subscriber,
  SubscriptionCheckResponse,
  SubscriptionsResponse,
  Subscription,
} from "../sdk-response-types";

// ============================================================================
// Subscription Query Hooks
// ============================================================================

/**
 * Parameters for {@link useSubscribedTo}
 */
type UseSubscribedToParams = {
  /**
   * The unique identifier of a farcaster user or app (unsigned integer)
   */
  fid: number;

  /**
   * When provided, adds `viewer_context` to each creator's user object with relationship status
   */
  viewer_fid?: number;

  /**
   * The provider of the subscription (only "fabric_stp" is currently supported)
   */
  subscription_provider: "fabric_stp";
};

/**
 * Fetch what FIDs and contracts a FID is subscribed to
 *
 * **Special Behaviors:**
 * - Not paginated (returns all subscriptions in single request)
 * - Only supports "fabric_stp" provider
 *
 * @param params - Query parameters for subscription lookups
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with subscribed-to data
 *
 * @example Basic subscribed-to list
 * ```tsx
 * function UserSubscribedTo({ fid }: { fid: number }) {
 *   const { data: subscriptions, isLoading } = useSubscribedTo({
 *     fid,
 *     subscription_provider: "fabric_stp"
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Subscribed To ({subscriptions?.length || 0})</h2>
 *       {subscriptions?.map(sub => (
 *         <div key={sub.contract_address}>
 *           <h3>{sub.metadata.title}</h3>
 *           <p>By: {sub.creator.display_name}</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSubscribers} for getting users that subscribe to this user
 * @see {@link useSubscriptions} for getting subscriptions created by this user
 */
export function useSubscribedTo(
  params: UseSubscribedToParams,
  options?: QueryHookOptions<SubscribedToResponse, SubscribedTo[]>,
): QueryHookResult<SubscribedTo[]> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<SubscribedToResponse, SubscribedTo[]>(
    neynarQueryKeys.subscriptions.subscribedTo(params.fid, params),
    `/api/neynar/v2/farcaster/user/subscribed_to?${queryParams}`,
    {
      staleTime: STALE_TIME.NORMAL,
      enabled: params.fid >= 0 && !!params.subscription_provider,
      ...options,
      select: (response: SubscribedToResponse) => response.subscribed_to || [],
    },
  );
}

/**
 * Parameters for {@link useSubscribers}
 */
type UseSubscribersParams = {
  /**
   * The unique identifier of a farcaster user or app (unsigned integer)
   */
  fid: number;

  /**
   * When provided, adds `viewer_context` to each subscriber's user object with relationship status
   */
  viewer_fid?: number;

  /**
   * The provider of the subscription (supported providers: "fabric_stp" | "paragraph")
   */
  subscription_provider: SubscriptionProvider;
};

/**
 * Fetch subscribers for a given FID's contracts. Doesn't return addresses that don't have an FID.
 *
 * **Special Behaviors:**
 * - Not paginated (returns all subscribers in single request)
 * - Only returns addresses that have an associated FID
 *
 * @param params - Query parameters for subscriber lookups
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with subscriber data
 *
 * @example Basic subscriber list
 * ```tsx
 * function UserSubscribers({ fid, viewerFid }: { fid: number; viewerFid: number }) {
 *   const {
 *     data: subscribers,
 *     isLoading,
 *     error
 *   } = useSubscribers({
 *     fid,
 *     viewer_fid: viewerFid,
 *     subscription_provider: "fabric_stp"
 *   });
 *
 *   if (isLoading) return <div>Loading subscribers...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Subscribers ({subscribers?.length || 0})</h2>
 *       {subscribers?.map(subscriber => (
 *         <div key={subscriber.user.fid}>
 *           <img src={subscriber.user.pfp_url} alt={subscriber.user.display_name} />
 *           <div>
 *             <h3>{subscriber.user.display_name} (@{subscriber.user.username})</h3>
 *             <p>{subscriber.user.follower_count} followers</p>
 *           </div>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With subscriber count and analytics
 * ```tsx
 * function SubscriberAnalytics({ creatorFid, viewerFid }: {
 *   creatorFid: number;
 *   viewerFid: number;
 * }) {
 *   const { data: subscribers } = useSubscribers({
 *     fid: creatorFid,
 *     viewer_fid: viewerFid,
 *     subscription_provider: "fabric_stp"
 *   });
 *
 *   const verifiedCount = subscribers?.filter(s => s.user.verified_account).length || 0;
 *   const powerBadgeCount = subscribers?.filter(s => s.user.power_badge).length || 0;
 *
 *   return (
 *     <div>
 *       <h3>Subscriber Analytics</h3>
 *       <p>Total Subscribers: {subscribers?.length || 0}</p>
 *       <p>Verified Accounts: {verifiedCount}</p>
 *       <p>Power Badge Users: {powerBadgeCount}</p>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSubscribedTo} for getting users that this user subscribes to
 * @see {@link useSubscriptions} for getting subscriptions created by this user
 */
export function useSubscribers(
  params: UseSubscribersParams,
  options?: QueryHookOptions<SubscribersResponse, Subscriber[]>,
): QueryHookResult<Subscriber[]> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<SubscribersResponse, Subscriber[]>(
    neynarQueryKeys.subscriptions.subscribers(params.fid, params),
    `/api/neynar/v2/farcaster/user/subscribers?${queryParams}`,
    {
      staleTime: STALE_TIME.NORMAL,
      enabled: params.fid >= 0 && !!params.subscription_provider,
      ...options,
      select: (response: SubscribersResponse) => response.subscribers || [],
    },
  );
}

/**
 * Parameters for {@link useSubscriptionCheck}
 */
type UseSubscriptionCheckParams = {
  /**
   * Comma separated list of Ethereum addresses, up to 350 at a time
   */
  addresses: string;

  /**
   * Ethereum address of the STP contract
   */
  contract_address: string;

  /**
   * Chain ID of the STP contract
   *
   * e.g., "1" for Ethereum mainnet
   */
  chain_id: string;
};

/**
 * Check if a wallet address is subscribed to a given STP (Hypersub) contract.
 *
 * **Special Behaviors:**
 * - Not paginated (returns all results in single request)
 * - Max 350 addresses per request
 * - Addresses must be comma-separated string format
 *
 * @param params - Query parameters for subscription validation
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with subscription status data
 *
 * @example Single address subscription gate
 * ```tsx
 * function SubscriptionGate({ userAddress, contractAddress }: {
 *   userAddress: string;
 *   contractAddress: string;
 * }) {
 *   const { data, isLoading, error } = useSubscriptionCheck({
 *     addresses: userAddress,
 *     contract_address: contractAddress,
 *     chain_id: "1" // Ethereum mainnet
 *   });
 *
 *   if (isLoading) return <div>Checking subscription status...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   const hasActiveSubscription = data?.[userAddress.toLowerCase()]?.status;
 *
 *   return (
 *     <div>
 *       {hasActiveSubscription ? (
 *         <div>
 *           <h3>Premium Content</h3>
 *           <p>You have an active subscription!</p>
 *           <div>Access granted</div>
 *         </div>
 *       ) : (
 *         <div>
 *           <h3>Subscription Required</h3>
 *           <p>Subscribe to access this content.</p>
 *           <button>Subscribe Now</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Bulk subscription check for multiple addresses
 * ```tsx
 * function BulkSubscriptionCheck({ addresses, contractAddress }: {
 *   addresses: string[];
 *   contractAddress: string;
 * }) {
 *   const { data, isLoading } = useSubscriptionCheck({
 *     addresses: addresses.join(","), // Max 350 addresses
 *     contract_address: contractAddress,
 *     chain_id: "1"
 *   });
 *
 *   if (isLoading) return <div>Checking {addresses.length} addresses...</div>;
 *
 *   const activeSubscribers = addresses.filter(addr =>
 *     data?.[addr.toLowerCase()]?.status
 *   );
 *
 *   return (
 *     <div>
 *       <h3>Subscription Status</h3>
 *       <p>
 *         {activeSubscribers.length} of {addresses.length} addresses
 *         have active subscriptions
 *       </p>
 *       <div>
 *         {addresses.map(addr => (
 *           <div key={addr}>
 *             <code>{addr.slice(0, 6)}...{addr.slice(-4)}</code>
 *             {data?.[addr.toLowerCase()]?.status ? (
 *               <span>Active</span>
 *             ) : (
 *               <span>Inactive</span>
 *             )}
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Premium content with expiry warning
 * ```tsx
 * function PremiumContent({ userAddress, contractAddress }: {
 *   userAddress: string;
 *   contractAddress: string;
 * }) {
 *   const { data } = useSubscriptionCheck({
 *     addresses: userAddress,
 *     contract_address: contractAddress,
 *     chain_id: "1"
 *   });
 *
 *   const subscription = data?.[userAddress.toLowerCase()];
 *
 *   if (!subscription?.status) {
 *     return <div>Please subscribe to view this content</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <h2>Premium Content</h2>
 *       <p>Your exclusive content here...</p>
 *       {subscription.expires_at && (
 *         <p>Subscription expires: {new Date(subscription.expires_at * 1000).toLocaleDateString()}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSubscribers} for getting subscriber lists
 * @see {@link useSubscriptions} for getting created subscriptions
 */
export function useSubscriptionCheck(
  params: UseSubscriptionCheckParams,
  options?: QueryHookOptions<
    SubscriptionCheckResponse,
    SubscriptionCheckResponse
  >,
): QueryHookResult<SubscriptionCheckResponse> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<SubscriptionCheckResponse, SubscriptionCheckResponse>(
    neynarQueryKeys.subscriptions.check(params),
    `/api/neynar/v2/stp/subscription_check?${queryParams}`,
    {
      staleTime: STALE_TIME.FREQUENT,
      enabled:
        !!params.addresses && !!params.contract_address && !!params.chain_id,
      ...options,
      select: (response: SubscriptionCheckResponse) => {
        return response;
      },
    },
  );
}

/**
 * Parameters for {@link useSubscriptions}
 */
type UseSubscriptionsParams = {
  /**
   * The unique identifier of a farcaster user or app (unsigned integer)
   */
  fid: number;

  /**
   * The provider of the subscription (only "fabric_stp" is currently supported)
   */
  subscription_provider: "fabric_stp";
};

/**
 * Fetch created subscriptions for a given FID's.
 *
 * **Special Behaviors:**
 * - Not paginated (returns all created subscriptions in single request)
 * - Only supports "fabric_stp" provider
 *
 * @param params - Query parameters for created subscription lookups
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with subscription offering data
 *
 * @example Basic subscription offerings list
 * ```tsx
 * function CreatorSubscriptions({ fid }: { fid: number }) {
 *   const {
 *     data: subscriptions,
 *     isLoading,
 *     error
 *   } = useSubscriptions({
 *     fid,
 *     subscription_provider: "fabric_stp"
 *   });
 *
 *   if (isLoading) return <div>Loading subscriptions...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *
 *   return (
 *     <div>
 *       <h2>Your Subscriptions ({subscriptions?.length || 0})</h2>
 *       {subscriptions?.map(subscription => (
 *         <div key={subscription.contract_address}>
 *           {subscription.metadata.art_url && (
 *             <img src={subscription.metadata.art_url} alt={subscription.metadata.title} />
 *           )}
 *           <h3>{subscription.metadata.title}</h3>
 *           <p>Symbol: {subscription.metadata.symbol}</p>
 *           <div>
 *             <span>Price: {subscription.price.tokens_per_period} {subscription.token.symbol}</span>
 *             <span>Chain: {subscription.chain}</span>
 *           </div>
 *           <button>Edit Subscription</button>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Subscription analytics dashboard
 * ```tsx
 * function SubscriptionAnalytics({ creatorFid }: { creatorFid: number }) {
 *   const { data: subscriptions } = useSubscriptions({
 *     fid: creatorFid,
 *     subscription_provider: "fabric_stp"
 *   });
 *
 *   const avgPeriodDuration = subscriptions && subscriptions.length > 0
 *     ? subscriptions.reduce((sum, sub) =>
 *         sum + sub.price.period_duration_seconds, 0
 *       ) / subscriptions.length
 *     : 0;
 *
 *   return (
 *     <div>
 *       <h3>Subscription Analytics</h3>
 *       <div>
 *         <p>Total Offerings: {subscriptions?.length || 0}</p>
 *         <p>Average Period Duration: {(avgPeriodDuration / 86400).toFixed(1)} days</p>
 *         <p>Chains: {subscriptions ? [...new Set(subscriptions.map(s => s.chain))].join(', ') : 'N/A'}</p>
 *       </div>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Creator dashboard with top subscriptions
 * ```tsx
 * function CreatorDashboard({ fid }: { fid: number }) {
 *   const { data: subscriptions, isLoading } = useSubscriptions({
 *     fid,
 *     subscription_provider: "fabric_stp"
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   const recentSubscriptions = subscriptions?.slice(0, 3) || [];
 *
 *   return (
 *     <div>
 *       <h2>Recent Subscriptions</h2>
 *       {recentSubscriptions.map((sub, idx) => (
 *         <div key={sub.contract_address}>
 *           <span>#{idx + 1}</span>
 *           <h4>{sub.metadata.title}</h4>
 *           <p>Chain: {sub.chain}</p>
 *           <p>Period: {(sub.price.period_duration_seconds / 86400).toFixed(0)} days</p>
 *           <p>Price: {sub.price.tokens_per_period} {sub.token.symbol}</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useSubscribers} for getting users that subscribe to this user
 * @see {@link useSubscribedTo} for getting users that this user subscribes to
 * @see {@link useSubscriptionCheck} for checking subscription status
 */
export function useSubscriptions(
  params: UseSubscriptionsParams,
  options?: QueryHookOptions<SubscriptionsResponse, Subscription[]>,
): QueryHookResult<Subscription[]> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<SubscriptionsResponse, Subscription[]>(
    neynarQueryKeys.subscriptions.created(params.fid, params),
    `/api/neynar/v2/farcaster/user/subscriptions_created?${queryParams}`,
    {
      staleTime: STALE_TIME.NORMAL,
      enabled: params.fid >= 0 && !!params.subscription_provider,
      ...options,
      select: (response: SubscriptionsResponse) =>
        (response.subscriptions_created || []) as unknown as Subscription[],
    },
  );
}
