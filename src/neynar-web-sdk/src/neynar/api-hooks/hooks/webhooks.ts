/**
 * Neynar Webhooks API Hooks
 *
 * React Query hooks for Neynar webhook management operations.
 * Comprehensive set of hooks covering all webhook-related endpoints from buildNeynarRoutes.
 * Uses TanStack Query v5 with proper error handling, type safety, and cache management.
 *
 * This module provides hooks for:
 * - Webhook lookup and retrieval
 * - Webhook creation and publishing
 * - Webhook updates and modifications
 * - Webhook deletion and cleanup
 * - Webhook status management (enable/disable)
 *
 * All hooks include proper TypeScript definitions, loading states, error handling,
 * and automatic cache invalidation for mutations.
 *
 * @example Basic webhook lookup
 * ```typescript
 * const { data: webhook, isLoading } = useWebhookLookup({ webhookId: "webhook-123" });
 * ```
 *
 * @example Creating a new webhook
 * ```typescript
 * const publishWebhook = usePublishWebhook({
 *   onSuccess: (webhook) => console.log('Created:', webhook.webhook_id)
 * });
 * publishWebhook.mutate({
 *   name: 'My Bot Webhook',
 *   url: 'https://mybot.example.com/webhook'
 * });
 * ```
 */

import {
  useApiQuery,
  useApiMutation,
  useApiQueryClient,
  STALE_TIME,
  type QueryHookOptions,
  type QueryHookResult,
  type ExtendedMutationOptions,
  type MutationHookResult,
} from "../../../private/api-hooks";
import { neynarQueryKeys } from "../query-keys";
import { buildNeynarQuery } from "../helpers";
import type {
  Webhook,
  WebhookResponse,
  WebhookPostReqBody,
  WebhookPutReqBody,
  WebhookDeleteReqBody,
  WebhookPatchReqBody,
} from "../sdk-response-types";

/**
 * Parameters for webhook lookup
 */
type UseWebhookLookupParams = {
  /**
   * Unique identifier for the webhook to retrieve
   */
  webhookId: string;
};

/**
 * Fetch a webhook
 *
 * Retrieves detailed information about a specific webhook including its configuration,
 * subscription filters, and current status.
 *
 * @param params - Webhook lookup parameters
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with webhook data
 *
 * @see {@link usePublishWebhook} for creating new webhooks
 * @see {@link useUpdateWebhook} for modifying webhook configuration
 * @see {@link useDeleteWebhook} for removing webhooks
 *
 * @example
 * ```tsx
 * function WebhookDetails({ webhookId }: { webhookId: string }) {
 *   const { data: webhook, isLoading } = useWebhookLookup({ webhookId });
 *   if (isLoading) return <div>Loading...</div>;
 *   return <div>{webhook?.title}</div>;
 * }
 * ```
 */
export function useWebhookLookup(
  params: UseWebhookLookupParams,
  options?: QueryHookOptions<WebhookResponse, Webhook>,
): QueryHookResult<Webhook> {
  const queryParams = buildNeynarQuery(params);

  return useApiQuery<WebhookResponse, Webhook>(
    neynarQueryKeys.webhooks.byId(params.webhookId),
    `/api/neynar/webhooks?${queryParams}`,
    {
      staleTime: STALE_TIME.NORMAL,
      enabled: Boolean(params.webhookId?.trim()),
      ...options,
      select: (response: WebhookResponse) => {
        if (!response.webhook) {
          throw new Error("Webhook not found in response");
        }
        return response.webhook;
      },
    },
  );
}

/**
 * Create a new webhook
 *
 * Publishes a new webhook with the specified configuration. The webhook will begin
 * receiving events based on its subscription filters once active.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link WebhookPostReqBody}`) => void` - Trigger webhook creation
 *
 * @see {@link useWebhookLookup} for retrieving webhook details
 * @see {@link useUpdateWebhook} for modifying webhooks
 * @see {@link useUpdateWebhookActiveStatus} for enabling/disabling webhooks
 *
 * @example
 * ```tsx
 * function CreateWebhook() {
 *   const publishWebhook = usePublishWebhook({
 *     onSuccess: (response) => console.log('Created:', response.webhook?.webhook_id)
 *   });
 *
 *   return (
 *     <button onClick={() => publishWebhook.mutate({
 *       name: 'My Bot Webhook',
 *       url: 'https://mybot.example.com/webhook',
 *       subscription: {
 *         'cast.created': { author_fids: [123, 456] }
 *       }
 *     })}>
 *       Create Webhook
 *     </button>
 *   );
 * }
 * ```
 */
export function usePublishWebhook(
  options?: ExtendedMutationOptions<WebhookResponse, WebhookPostReqBody>,
): MutationHookResult<WebhookResponse, WebhookPostReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<WebhookResponse, WebhookPostReqBody>(
    "/api/neynar/webhooks",
    "POST",
    {
      onSuccess: (data, variables, context, meta) => {
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.list(),
        });

        options?.onSuccess?.(data, variables, context, meta);
      },
      ...options,
    },
  );
}

/**
 * Update existing webhook
 *
 * Modifies an existing webhook's configuration including name, URL, and subscription filters.
 * The webhook will continue operating with the new configuration after update.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link WebhookPutReqBody}`) => void` - Trigger webhook update
 *
 * @see {@link useWebhookLookup} for retrieving current configuration
 * @see {@link usePublishWebhook} for creating new webhooks
 * @see {@link useUpdateWebhookActiveStatus} for toggling active status
 *
 * @example
 * ```tsx
 * function UpdateWebhook({ webhookId }: { webhookId: string }) {
 *   const updateWebhook = useUpdateWebhook({
 *     onSuccess: () => alert('Webhook updated!')
 *   });
 *
 *   return (
 *     <button onClick={() => updateWebhook.mutate({
 *       webhook_id: webhookId,
 *       name: 'Updated Webhook',
 *       url: 'https://mybot.example.com/new-webhook'
 *     })}>
 *       Update
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdateWebhook(
  options?: ExtendedMutationOptions<WebhookResponse, WebhookPutReqBody>,
): MutationHookResult<WebhookResponse, WebhookPutReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<WebhookResponse, WebhookPutReqBody>(
    "/api/neynar/webhooks",
    "PUT",
    {
      onSuccess: (data, variables, context, meta) => {
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.byId(variables.webhook_id),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.list(),
        });

        options?.onSuccess?.(data, variables, context, meta);
      },
      ...options,
    },
  );
}

/**
 * Delete a webhook
 *
 * Permanently removes a webhook and stops all event delivery to its endpoint.
 * This action cannot be undone.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link WebhookDeleteReqBody}`) => void` - Trigger webhook deletion
 *
 * @see {@link useUpdateWebhookActiveStatus} for temporarily disabling webhooks
 * @see {@link useWebhookLookup} for verifying webhook details
 * @see {@link usePublishWebhook} for creating replacement webhooks
 *
 * @example
 * ```tsx
 * function DeleteWebhookButton({ webhookId }: { webhookId: string }) {
 *   const deleteWebhook = useDeleteWebhook({
 *     onSuccess: () => alert('Webhook deleted')
 *   });
 *
 *   return (
 *     <button onClick={() => deleteWebhook.mutate({ webhook_id: webhookId })}>
 *       Delete Webhook
 *     </button>
 *   );
 * }
 * ```
 */
export function useDeleteWebhook(
  options?: ExtendedMutationOptions<WebhookResponse, WebhookDeleteReqBody>,
): MutationHookResult<WebhookResponse, WebhookDeleteReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<WebhookResponse, WebhookDeleteReqBody>(
    "/api/neynar/webhooks",
    "DELETE",
    {
      onSuccess: (data, variables, context, meta) => {
        queryClient.removeQueries({
          queryKey: neynarQueryKeys.webhooks.byId(variables.webhook_id),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.list(),
        });

        options?.onSuccess?.(data, variables, context, meta);
      },
      ...options,
    },
  );
}

/**
 * Update webhook active status
 *
 * Toggles a webhook's active status without modifying its configuration.
 * Inactive webhooks will not receive event deliveries.
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link WebhookPatchReqBody}`) => void` - Trigger status update
 *
 * @see {@link useUpdateWebhook} for changing webhook configuration
 * @see {@link useDeleteWebhook} for permanently removing webhooks
 * @see {@link useWebhookLookup} for checking current status
 *
 * @example
 * ```tsx
 * function WebhookToggle({ webhook }: { webhook: Webhook }) {
 *   const updateStatus = useUpdateWebhookActiveStatus({
 *     onSuccess: () => alert('Status updated!')
 *   });
 *
 *   return (
 *     <button onClick={() => updateStatus.mutate({
 *       webhook_id: webhook.webhook_id,
 *       active: webhook.active ? 'false' : 'true'
 *     })}>
 *       {webhook.active ? 'Disable' : 'Enable'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useUpdateWebhookActiveStatus(
  options?: ExtendedMutationOptions<WebhookResponse, WebhookPatchReqBody>,
): MutationHookResult<WebhookResponse, WebhookPatchReqBody> {
  const queryClient = useApiQueryClient();

  return useApiMutation<WebhookResponse, WebhookPatchReqBody>(
    "/api/neynar/webhooks/active-status",
    "PATCH",
    {
      onSuccess: (data, variables, context, meta) => {
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.byId(variables.webhook_id),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.all(),
        });
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.webhooks.list(),
        });

        options?.onSuccess?.(data, variables, context, meta);
      },
      ...options,
    },
  );
}
