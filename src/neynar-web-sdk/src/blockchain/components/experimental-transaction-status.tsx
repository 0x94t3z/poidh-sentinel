"use client";

import { useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
import { Alert, AlertTitle, AlertDescription, Spinner } from "@neynar/ui";
import { CheckCircle, AlertCircle } from "lucide-react";

/**
 * ExperimentalTransactionStatus - Display transaction confirmation status with explorer link
 *
 * Shows real-time transaction status with loading, success, and error states.
 * Automatically tracks transaction confirmation and displays appropriate UI.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ExperimentalTransactionStatus hash={txHash} />
 * ```
 *
 * @example
 * ```tsx
 * // With specific explorer
 * <ExperimentalTransactionStatus
 *   hash={txHash}
 *   explorer="etherscan"
 *   showLink
 * />
 * ```
 */
type ExperimentalTransactionStatusProps = {
  /** Transaction hash to track */
  hash?: Address;
  /** Show block explorer link (default: true) */
  showLink?: boolean;
  /** Block explorer to use (default: "basescan") */
  explorer?: "basescan" | "etherscan" | "optimistic";
  /** Optional CSS classes */
  className?: string;
};

export function ExperimentalTransactionStatus({
  hash,
  showLink = true,
  explorer = "basescan",
  className,
}: ExperimentalTransactionStatusProps) {
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
  });

  if (!hash) {
    return null;
  }

  const explorerUrls = {
    basescan: "https://basescan.org/tx/",
    etherscan: "https://etherscan.io/tx/",
    optimistic: "https://optimistic.etherscan.io/tx/",
  };

  const explorerUrl = `${explorerUrls[explorer]}${hash}`;

  if (isLoading) {
    return (
      <div className={className}>
        <Alert>
          <Spinner className="size-4" />
          <AlertDescription>Confirming transaction...</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className={className}>
        <Alert variant="default">
          <CheckCircle className="size-4" />
          <AlertTitle>Transaction Confirmed</AlertTitle>
          {showLink && (
            <AlertDescription>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all"
              >
                View on explorer →
              </a>
            </AlertDescription>
          )}
        </Alert>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Transaction Failed</AlertTitle>
          <AlertDescription>
            The transaction could not be completed.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return null;
}
