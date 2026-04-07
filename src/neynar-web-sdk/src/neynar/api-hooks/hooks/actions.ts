/**
 * Neynar Actions API Hooks
 *
 * React Query hooks for Neynar actions and related functionality.
 * Uses TanStack Query v5 with proper error handling and type safety.
 */

import {
  useApiMutation,
  useApiQueryClient,
  type ExtendedMutationOptions,
  type MutationHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import type { FarcasterActionResponse } from "../sdk-response-types";

// ============================================================================
// Action Mutation Hooks
// ============================================================================

/**
 * Parameters for publishing a Farcaster action
 *
 * @see {@link usePublishFarcasterAction}
 */
export type UsePublishFarcasterActionParams = {
  /**
   * The signer_uuid of the user on behalf of whom the action is being performed
   *
   * This UUID identifies the user's Farcaster signer that will sign the action message,
   * enabling cross-app communication on behalf of the user.
   */
  signer_uuid: string;

  /**
   * The base URL of the app on which the action is being performed
   *
   * This URL identifies the target app where the action will be executed.
   * Must be a valid HTTP/HTTPS URL.
   */
  base_url: string;

  /**
   * Action details including type and payload
   *
   * **Properties:**
   * - `type: string` - The type of action being performed (e.g., "message", "follow", etc.)
   * - `payload?: object` - Optional payload data specific to the action type
   *
   * @see {@link FarcasterActionReqBodyAction}
   */
  action: {
    /**
     * The type of action being performed
     */
    type: string;

    /**
     * The payload of the action being performed
     */
    payload?: object;
  };
};

/**
 * Securely communicate and perform actions on behalf of users across different apps
 *
 * Enables an app to send data or trigger actions in another app on behalf of a mutual user
 * by signing messages using the user's Farcaster signer. This is useful for cross-app
 * communication where apps need to interact with each other's APIs on behalf of shared users.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link UsePublishFarcasterActionParams}`) => void` - Trigger action publish
 *
 * @example Basic action publishing
 * ```tsx
 * function ActionPublisher({ signerUuid }: { signerUuid: string }) {
 *   const publishAction = usePublishFarcasterAction({
 *     onSuccess: (data) => {
 *       console.log('Action published successfully:', data);
 *     },
 *     onError: (error) => {
 *       console.error('Failed to publish action:', error);
 *     }
 *   });
 *
 *   const handleAction = () => {
 *     publishAction.mutate({
 *       signer_uuid: signerUuid,
 *       base_url: "https://myapp.com",
 *       action: {
 *         type: "message",
 *         payload: { message: "Hello from my app!" }
 *       }
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleAction} disabled={publishAction.isPending}>
 *       {publishAction.isPending ? 'Publishing...' : 'Publish Action'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link https://docs.neynar.com/reference/publish-farcaster-action} for API documentation
 */
export function usePublishFarcasterAction(
  options?: ExtendedMutationOptions<
    FarcasterActionResponse,
    UsePublishFarcasterActionParams
  >,
): MutationHookResult<
  FarcasterActionResponse,
  UsePublishFarcasterActionParams
> {
  const queryClient = useApiQueryClient();

  return useApiMutation<
    FarcasterActionResponse,
    UsePublishFarcasterActionParams
  >("/api/neynar/actions/farcaster", "POST", {
    onSuccess: (data, variables, context, meta) => {
      // Invalidate action-related queries
      queryClient.invalidateQueries({
        queryKey: neynarQueryKeys.actions.all(),
      });

      // Invalidate feeds that might be affected by the action
      queryClient.invalidateQueries({
        queryKey: neynarQueryKeys.feeds.all(),
      });

      // Invalidate user's cast feeds if this action might affect their content
      if (variables.signer_uuid) {
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.casts.all(),
        });
      }

      // Call user-provided onSuccess handler
      options?.onSuccess?.(data, variables, context, meta);
    },
    ...options,
  });
}
