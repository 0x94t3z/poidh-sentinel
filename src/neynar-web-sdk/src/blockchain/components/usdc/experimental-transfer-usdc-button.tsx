"use client";

import { useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import { useUsdcTransfer } from "../../contracts/base/usdc";
import type { Address } from "viem";
import { Button, Spinner } from "@neynar/ui";

/**
 * ExperimentalTransferUsdcButton - One-click USDC transfer button with transaction lifecycle handling
 *
 * A simple button component that handles USDC transfers with automatic state management:
 * - Shows loading states during transaction (Confirming → Processing → Success)
 * - Calls lifecycle callbacks at each transaction stage
 * - Automatically disables during transaction
 * - Handles errors gracefully
 *
 * Perfect for simple payment flows, tips, or one-click purchases.
 *
 * @example
 * ```tsx
 * // Basic transfer
 * <ExperimentalTransferUsdcButton
 *   to="0xRecipient..."
 *   amountUsdc={10}
 *   onSuccess={(hash) => console.log("Sent!", hash)}
 * >
 *   Send 10 USDC
 * </ExperimentalTransferUsdcButton>
 * ```
 *
 * @example
 * ```tsx
 * // Tip button with tracking
 * <ExperimentalTransferUsdcButton
 *   to={creatorAddress}
 *   amountUsdc={1}
 *   variant="secondary"
 *   onPending={() => analytics.track("tip_initiated")}
 *   onSuccess={(hash) => {
 *     analytics.track("tip_sent", { hash, amount: 1 });
 *     showThankYou();
 *   }}
 * >
 *   Tip $1
 * </ExperimentalTransferUsdcButton>
 * ```
 */
type ExperimentalTransferUsdcButtonProps = {
  /** Recipient wallet address */
  to: Address;
  /** Amount in USDC (human-readable, e.g., 10 = 10 USDC) */
  amountUsdc: number;
  /** Called when user confirms transaction in wallet */
  onPending?: () => void;
  /** Called when transaction is submitted to blockchain */
  onConfirming?: (hash: Address) => void;
  /** Called when transaction is confirmed on blockchain */
  onSuccess?: (hash: Address) => void;
  /** Called if transaction fails */
  onError?: (error: Error) => void;
  /** Button text - defaults to "Transfer" */
  children?: React.ReactNode;
  /** Optional CSS classes */
  className?: string;
  /** Disable the button */
  disabled?: boolean;
  /** Button style variant */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
};

export function ExperimentalTransferUsdcButton({
  to,
  amountUsdc,
  onPending,
  onConfirming,
  onSuccess,
  onError,
  children,
  disabled,
  className,
  variant = "default",
  size = "default",
}: ExperimentalTransferUsdcButtonProps) {
  const { write, data: hash, isPending, error } = useUsdcTransfer();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isPending && onPending) {
      onPending();
    }
  }, [isPending, onPending]);

  useEffect(() => {
    if (hash && isLoading && onConfirming) {
      onConfirming(hash);
    }
  }, [hash, isLoading, onConfirming]);

  useEffect(() => {
    if (isSuccess && hash && onSuccess) {
      onSuccess(hash);
    }
  }, [isSuccess, hash, onSuccess]);

  useEffect(() => {
    if (error && onError) {
      onError(error as Error);
    }
  }, [error, onError]);

  const handleTransfer = () => {
    write({ to, value: BigInt(Math.floor(amountUsdc * 1_000_000)) });
  };

  const buttonText = isPending
    ? "Confirming..."
    : isLoading
      ? "Processing..."
      : isSuccess
        ? "Success!"
        : (children ?? "Transfer");

  return (
    <Button
      onClick={handleTransfer}
      disabled={disabled || isLoading || isPending || isSuccess}
      className={className}
      variant={variant}
      size={size}
    >
      {isLoading && <Spinner className="mr-2 size-4" />}
      {buttonText}
    </Button>
  );
}
