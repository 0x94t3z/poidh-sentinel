/**
 * Neynar App Host API hooks
 *
 * Comprehensive set of hooks for app host events and user state management.
 * Provides functionality for tracking app events, managing user state within
 * applications, and handling app host-specific operations.
 *
 * @example
 * ```typescript
 * // Query app host event
 * const { data: event } = useAppHostEvent({
 *   event_type: 'user_action',
 *   viewer_fid: 123
 * });
 *
 * // Get user state for an app
 * const { data: userState } = useAppHostUserState({
 *   fid: 123,
 *   app_id: 'my-app'
 * });
 *
 * // Post new app event
 * const postEvent = usePostAppHostEvent();
 * postEvent.mutate({
 *   event_type: 'click',
 *   event_data: { button: 'subscribe' },
 *   user_fid: 123
 * });
 * ```
 */

import {
  useApiQuery,
  useApiMutation,
  useApiQueryClient,
  STALE_TIME,
  type ExtendedMutationOptions,
  type QueryHookOptions,
  type QueryHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type {
  AppHostGetEventResponse,
  AppHostUserStateResponse,
  AppHostPostEventResponse,
  AppHostPostEventReqBody,
} from "../sdk-response-types";

/**
 * Parameters for {@link useAppHostEvent}
 */
type UseAppHostEventParams = {
  /**
   * The domain of the mini app
   */
  appDomain: string;

  /**
   * The FID of the user who initiated the event
   */
  fid: number;

  /**
   * The type of event:
   * - `"frame_added"` - User installs frame
   * - `"frame_removed"` - User uninstalls frame
   * - `"notifications_enabled"` - User enables notifications
   * - `"notifications_disabled"` - User disables notifications
   */
  event:
    | "frame_added"
    | "frame_removed"
    | "notifications_enabled"
    | "notifications_disabled";
};

/**
 * Returns event object for app host events
 *
 * Used if the app host intends to sign the event message instead of using Neynar-hosted signers.
 * This hook generates the event data structure needed to communicate app lifecycle changes
 * (frame installation/removal, notification preferences) when using custom signing instead of
 * Neynar's managed signers.
 *
 * **Special Behaviors:**
 * - `notificationDetails` only present in response when event is `'notifications_enabled'`
 *
 * @param params - Event generation parameters
 * @param params.appDomain - The domain of the mini app
 * @param params.fid - The FID of the user who initiated the event
 * @param params.event - The type of event
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with app host event data
 *
 * @example Basic usage
 * ```tsx
 * function FrameInstallTracker({ appDomain, userFid }: { appDomain: string; userFid: number }) {
 *   const { data: eventData, isLoading } = useAppHostEvent({
 *     appDomain,
 *     fid: userFid,
 *     event: "frame_added"
 *   });
 *   if (isLoading) return <div>Generating event...</div>;
 *   return <div>Event Type: {eventData?.event}</div>;
 * }
 * ```
 *
 * @see {@link usePostAppHostEvent} for submitting app host events to webhook after generating
 * @see {@link useAppHostUserState} for checking current notification state across domains
 */
export function useAppHostEvent(
  params: UseAppHostEventParams,
  options?: QueryHookOptions<AppHostGetEventResponse, AppHostGetEventResponse>,
): QueryHookResult<AppHostGetEventResponse> {
  const { appDomain, fid, event } = params;
  const queryParams = buildNeynarQuery({ appDomain, fid, event });

  return useApiQuery<AppHostGetEventResponse, AppHostGetEventResponse>(
    neynarQueryKeys.appHost.event({ appDomain, fid, event }),
    `/api/neynar/app-host/event?${queryParams}`,
    {
      enabled: Boolean(appDomain?.trim() && fid && event),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (response: AppHostGetEventResponse) => {
        // SDK returns: { event: string, notificationDetails?: {...} }
        // Pass through entire response - it's a simple event object
        return response;
      },
    },
  );
}

/**
 * Parameters for {@link useAppHostUserState}
 */
type UseAppHostUserStateParams = {
  /**
   * The FID of the user whose notification preferences to fetch
   */
  fid: number;
};

/**
 * Returns the current notification state for a specific user across all mini app domains in this app host
 *
 * Fetches which mini app domains have notifications enabled for the user. Essential for building
 * notification management interfaces and conditional notification flows in multi-domain apps.
 * Shows complete notification status including domain, validity, and last update timestamp.
 *
 * @param params - User state query parameters
 * @param params.fid - The FID of the user whose notification preferences to fetch
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with user state data
 *
 * @example Basic user notification state display
 * ```tsx
 * function UserNotificationStatus({ fid }: { fid: number }) {
 *   const { data: userState, isLoading, error } = useAppHostUserState({ fid });
 *
 *   if (isLoading) return <div>Loading notification status...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!userState?.notifications_enabled?.length) {
 *     return <div>No notifications enabled</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <h3>Notifications Enabled For:</h3>
 *       <ul>
 *         {userState.notifications_enabled.map((notif) => (
 *           <li key={notif.domain}>
 *             <strong>{notif.domain}</strong>
 *             {notif.enabled_at && (
 *               <span> - Enabled: {new Date(notif.enabled_at).toLocaleDateString()}</span>
 *             )}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Check if notifications enabled for specific domain
 * ```tsx
 * function DomainNotificationToggle({ fid, domain }: { fid: number; domain: string }) {
 *   const { data: userState } = useAppHostUserState({ fid });
 *
 *   const isEnabled = userState?.notifications_enabled?.some(
 *     (notif) => notif.domain === domain
 *   );
 *
 *   return (
 *     <div>
 *       <h4>Notifications for {domain}</h4>
 *       <p>Status: {isEnabled ? 'Enabled' : 'Disabled'}</p>
 *       {isEnabled && (
 *         <span>You will receive notifications from this app</span>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link usePostAppHostEvent} for toggling notifications on/off for domains
 * @see {@link useAppHostEvent} for generating event payloads with notification details
 */
export function useAppHostUserState(
  params: UseAppHostUserStateParams,
  options?: QueryHookOptions<
    AppHostUserStateResponse,
    AppHostUserStateResponse
  >,
): QueryHookResult<AppHostUserStateResponse> {
  const { fid } = params;
  const queryParams = buildNeynarQuery({ fid });

  return useApiQuery<AppHostUserStateResponse, AppHostUserStateResponse>(
    neynarQueryKeys.appHost.userState({ fid }),
    `/api/neynar/app-host/user-state?${queryParams}`,
    {
      enabled: Boolean(fid),
      staleTime: STALE_TIME.FREQUENT,
      ...options,
      select: (response: AppHostUserStateResponse) => {
        // SDK returns: { notifications_enabled: Array<{ domain: string, ... }> }
        // Pass through entire response - it contains the notifications array
        return response;
      },
    },
  );
}

/**
 * Post an app host event to the domain's webhook
 *
 * Submits app lifecycle events (frame install/removal, notification enable/disable) to the
 * configured webhook endpoint for the mini app domain. Supports two authentication methods:
 * custom-signed messages for advanced use cases, or Neynar-managed signers for simplified
 * integration. Essential for tracking user engagement and managing notification preferences.
 *
 * **Mutation Parameters:**
 *
 * Pass parameters as the argument to `mutate()`. This is a union type - provide EITHER option 1 (signed_message) OR option 2 (signer_uuid):
 *
 * **Option 1: Using signed_message**
 * - `signed_message` - JFS-signed message containing the event payload (can be string or object with header/payload/signature)
 * - `app_domain` - Domain of the mini app
 *
 * **Option 2: Using signer_uuid**
 * - `signer_uuid` - UUID of the signer (paired with API key)
 * - `app_domain` - Domain of the mini app
 * - `fid` - The unique identifier of a farcaster user or app
 * - `event` - Event type: `"frame_added"` | `"frame_removed"` | `"notifications_enabled"` | `"notifications_disabled"`
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link AppHostPostEventReqBody}`) => void` - Trigger event post
 *
 * @example Enable notifications for user
 * ```tsx
 * function EnableNotificationsButton({ appDomain, fid, signerUuid }: {
 *   appDomain: string;
 *   fid: number;
 *   signerUuid: string;
 * }) {
 *   const postEvent = usePostAppHostEvent({
 *     onSuccess: (data) => {
 *       console.log('Notifications enabled:', data.success);
 *       alert('Notifications enabled successfully!');
 *     },
 *     onError: (error) => {
 *       console.error('Failed to enable notifications:', error);
 *       alert(`Error: ${error.message}`);
 *     }
 *   });
 *
 *   const handleEnable = () => {
 *     postEvent.mutate({
 *       signer_uuid: signerUuid,
 *       app_domain: appDomain,
 *       event: 'notifications_enabled',
 *       fid
 *     });
 *   };
 *
 *   return (
 *     <button
 *       onClick={handleEnable}
 *       disabled={postEvent.isPending}
 *     >
 *       {postEvent.isPending ? 'Enabling...' : 'Enable Notifications'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useAppHostEvent} for generating signed event payloads before posting
 * @see {@link useAppHostUserState} for verifying notification state after posting events
 */
export function usePostAppHostEvent(
  options?: ExtendedMutationOptions<
    AppHostPostEventResponse,
    AppHostPostEventReqBody
  >,
) {
  const queryClient = useApiQueryClient();

  return useApiMutation<AppHostPostEventResponse, AppHostPostEventReqBody>(
    "/api/neynar/app-host/event",
    "POST",
    {
      onSuccess: (data, variables, context, meta) => {
        // Invalidate related queries to refresh data
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.appHost.event(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.appHost.userState(),
        });

        // Call user-provided success handler
        options?.onSuccess?.(data, variables, context, meta);
      },
      ...options,
    },
  );
}
