/**
 * Neynar Transactions API Hooks
 *
 * React Query hooks for Neynar transaction frame operations.
 * Uses TanStack Query v5 with proper error handling, type safety, and automatic cache invalidation.
 *
 * This module provides comprehensive hooks for transaction frame functionality including:
 * - Transaction pay frame creation with customizable configuration
 * - Pay frame retrieval and verification
 * - EVM-compatible transaction support across multiple chains
 * - Line item display configuration for payment breakdowns
 * - Idempotency key support to prevent duplicate frames
 *
 * Transaction frames enable secure payment flows directly within Farcaster, allowing users
 * to initiate blockchain transactions through frame interactions with full transparency
 * of transaction details and costs.
 *
 * @example Basic Usage
 * ```tsx
 * import { useCreateTransactionPayFrame, useTransactionPayFrame } from '@/neynar-web-sdk/api-hooks';
 *
 * function PaymentFlow() {
 *   const createFrame = useCreateTransactionPayFrame();
 *   const { data: frame } = useTransactionPayFrame({ id: frameId });
 *
 *   const handlePayment = () => {
 *     createFrame.mutate({
 *       transaction: {
 *         to: '0x742aBb4b2B3bd86D3dB2E9e6f7f0Fe7b98E5D2a1',
 *         value: '1000000000000000000' // 1 ETH in Wei
 *       },
 *       config: {
 *         line_items: [{ label: 'Product', amount: '1.0 ETH' }]
 *       }
 *     });
 *   };
 *
 *   return <button onClick={handlePayment}>Create Payment</button>;
 * }
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
  TransactionFrameResponse,
  TransactionFrame,
} from "../sdk-response-types";

// ============================================================================
// Transaction Frame API Types
// ============================================================================

/**
 * Parameters for creating a transaction pay frame
 *
 * Creates a payment frame that enables blockchain transactions within Farcaster.
 * All fields match the SDK's {@link FramePayTransactionReqBody} structure.
 *
 * @see {@link useCreateTransactionPayFrame}
 */
export type UseCreateTransactionPayFrameParams = {
  /**
   * Transaction details including recipient, network, token, and amount
   *
   * **Required Fields:**
   * - `to.address: string` - Recipient Ethereum address
   * - `to.network: "ethereum" | "optimism" | "base" | "arbitrum"` - Target blockchain network
   * - `to.token_contract_address: string` - Token contract address (e.g., 0x833589fcd6edb6e08f4c7c32d4f71b54bda02913 for USDC on Base)
   * - `to.amount: number` - Amount to send (must be greater than 0)
   *
   * **Constraint:**
   * - Amount must be > 0 (enforced by API)
   */
  transaction: {
    to: {
      address: string;
      network: "ethereum" | "optimism" | "base" | "arbitrum";
      token_contract_address: string;
      amount: number;
    };
  };

  /**
   * Frame configuration including line items, allowlist, and action button
   *
   * **Required Fields:**
   * - `line_items: Array<{ name: string; description: string; image?: string }>` - At least one line item required
   *
   * **Optional Fields:**
   * - `allowlist_fids?: number[]` - List of FIDs allowed to use this frame
   * - `action?: { text?: string; text_color?: string; button_color?: string }` - Custom action button styling
   *
   * **Constraint:**
   * - line_items array must contain at least one item (enforced by API)
   */
  config: {
    line_items: Array<{
      name: string;
      description: string;
      image?: string;
    }>;
    allowlist_fids?: number[];
    action?: {
      text?: string;
      text_color?: string;
      button_color?: string;
    };
  };

  /**
   * Idempotency key for preventing duplicate frame creation
   *
   * **Recommended Format:**
   * - 16-character unique string generated at request time
   * - Use same key on retry attempts to prevent duplicates
   *
   * **Example:** "sub-payment-123" or randomly generated unique ID
   */
  idem?: string;
};

/**
 * Parameters for getting a transaction pay frame
 *
 * Retrieves details of a previously created transaction payment frame.
 *
 * @see {@link useTransactionPayFrame}
 */
export type UseTransactionPayFrameParams = {
  /**
   * ID of the transaction frame to retrieve
   *
   * **Required:** Yes
   * **Type:** string
   */
  id: string;
};

// ============================================================================
// Transaction Frame Hooks
// ============================================================================

/**
 * Creates a transaction pay frame that can be used to collect payments through Farcaster
 *
 * Enables secure blockchain payment flows directly within Farcaster frames with full
 * transparency of transaction details and costs.
 *
 * **Special Behaviors:**
 * - API enforces `transaction.to.amount > 0` (returns error if not met)
 * - API requires `config.line_items` to have at least one item
 * - Idempotency key (`idem`) prevents duplicate frame creation on retries
 *
 * @param options - TanStack Query mutation options for callbacks and error handling
 * @returns TanStack Query mutation result
 *   - `mutate: (params:` {@link UseCreateTransactionPayFrameParams} `) => void` - Trigger frame creation
 *
 * @example Basic USDC payment on Base
 * ```tsx
 * function CreatePaymentFrame() {
 *   const createFrame = useCreateTransactionPayFrame({
 *     onSuccess: (response) => {
 *       console.log('Frame URL:', response.transaction_frame.url);
 *     }
 *   });
 *
 *   const handleCreate = () => {
 *     createFrame.mutate({
 *       transaction: {
 *         to: {
 *           address: '0x8E9bFa938E3631B9351A83DdA88C1f89d79E7585',
 *           network: 'base',
 *           token_contract_address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
 *           amount: 10.5
 *         }
 *       },
 *       config: {
 *         line_items: [
 *           {
 *             name: 'Premium Subscription',
 *             description: 'Monthly premium access',
 *             image: 'https://example.com/image.png'
 *           }
 *         ]
 *       },
 *       idem: 'sub-payment-123'
 *     });
 *   };
 *
 *   return (
 *     <button onClick={handleCreate} disabled={createFrame.isPending}>
 *       {createFrame.isPending ? 'Creating...' : 'Create Payment'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @see {@link useTransactionPayFrame} for retrieving created payment frames
 * @see {@link https://docs.neynar.com/reference/create-transaction-pay-frame | Neynar API Documentation}
 */
export function useCreateTransactionPayFrame(
  options?: ExtendedMutationOptions<
    TransactionFrameResponse,
    UseCreateTransactionPayFrameParams
  >,
): MutationHookResult<
  TransactionFrameResponse,
  UseCreateTransactionPayFrameParams
> {
  const queryClient = useApiQueryClient();

  return useApiMutation<
    TransactionFrameResponse,
    UseCreateTransactionPayFrameParams
  >("/api/neynar/transactions/pay-frame", "POST", {
    onSuccess: (data) => {
      // Invalidate all transaction frame queries to refresh caches
      queryClient.invalidateQueries({
        queryKey: neynarQueryKeys.transactions.all(),
      });
      // Invalidate specific frame query if we have an ID
      if (data?.transaction_frame?.id) {
        queryClient.invalidateQueries({
          queryKey: neynarQueryKeys.transactions.byId(
            data.transaction_frame.id,
          ),
        });
      }
    },
    ...options,
  });
}

/**
 * Retrieves details of a previously created transaction payment frame by its ID
 *
 * @param params - Query parameters (see {@link UseTransactionPayFrameParams})
 * @param options - TanStack Query options for caching and request behavior
 * @returns TanStack Query result with transaction frame data
 *
 * @example Basic frame retrieval
 * ```tsx
 * function PaymentFrameDetails({ frameId }: { frameId: string }) {
 *   const { data: frame, isLoading } = useTransactionPayFrame({ id: frameId });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (!frame) return <div>Frame not found</div>;
 *
 *   return (
 *     <div>
 *       <p>Status: {frame.status}</p>
 *       <p>Network: {frame.transaction.to.network}</p>
 *       <p>Amount: {frame.transaction.to.amount}</p>
 *       <a href={frame.url}>View Frame</a>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link useCreateTransactionPayFrame} for creating new payment frames
 * @see {@link https://docs.neynar.com/reference/get-transaction-pay-frame | Neynar API Documentation}
 */
export function useTransactionPayFrame(
  params: UseTransactionPayFrameParams,
  options?: QueryHookOptions<TransactionFrameResponse, TransactionFrame>,
): QueryHookResult<TransactionFrame> {
  const queryParams = buildNeynarQuery({ ...params });

  return useApiQuery<TransactionFrameResponse, TransactionFrame>(
    neynarQueryKeys.transactions.byId(params.id),
    `/api/neynar/transactions/pay-frame?${queryParams}`,
    {
      staleTime: STALE_TIME.NORMAL,
      enabled: Boolean(params.id?.trim()),
      ...options,
      select: (response: TransactionFrameResponse) => {
        // SDK returns: { transaction_frame: TransactionFrame }
        // Extract the transaction_frame object from the response
        return response?.transaction_frame;
      },
    },
  );
}
