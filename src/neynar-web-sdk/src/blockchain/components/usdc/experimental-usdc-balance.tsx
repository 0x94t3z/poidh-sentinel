"use client";

import { useAccount } from "wagmi";
import {
  useUsdcBalanceOf,
  useUsdcSymbol,
  useUsdcDecimals,
} from "../../contracts/base/usdc";
import type { Address } from "viem";
import { Skeleton } from "@neynar/ui";

/**
 * ExperimentalUsdcBalance - Display USDC balance with flexible formatting
 *
 * Shows a wallet's USDC balance with customizable decimal places and optional symbol display.
 * Handles loading states gracefully with a skeleton loader.
 *
 * @example
 * ```tsx
 * // Show connected wallet's balance
 * <ExperimentalUsdcBalance showSymbol decimals={2} />
 * ```
 *
 * @example
 * ```tsx
 * // Show specific address balance
 * <ExperimentalUsdcBalance
 *   address="0x123..."
 *   showSymbol
 *   decimals={4}
 * />
 * ```
 */
type ExperimentalUsdcBalanceProps = {
  /** Wallet address to check - defaults to connected wallet */
  address?: Address;
  /** Show "USDC" symbol after balance */
  showSymbol?: boolean;
  /** Decimal places to display (default: 2) */
  decimals?: number;
  /** Optional CSS classes */
  className?: string;
};

export function ExperimentalUsdcBalance({
  address: providedAddress,
  showSymbol,
  decimals = 2,
  className,
}: ExperimentalUsdcBalanceProps) {
  const { address: connectedAddress } = useAccount();
  const address = providedAddress || connectedAddress;

  const { data: balance, isLoading: balanceLoading } = useUsdcBalanceOf(
    address!,
    { enabled: !!address },
  );
  const { data: symbol, isLoading: symbolLoading } = useUsdcSymbol();
  const { data: tokenDecimals, isLoading: tokenDecimalsLoading } =
    useUsdcDecimals();

  if (!address) {
    return null;
  }

  if (balanceLoading || symbolLoading || tokenDecimalsLoading) {
    return <Skeleton className="h-4 w-16 inline-block" />;
  }

  const formattedBalance =
    balance && tokenDecimals
      ? (Number(balance) / Math.pow(10, tokenDecimals)).toFixed(decimals)
      : "0.00";

  return (
    <span className={className}>
      {formattedBalance}
      {showSymbol && symbol && ` ${symbol}`}
    </span>
  );
}
