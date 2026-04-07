"use client";

import { useState, useEffect } from "react";
import type { Address } from "viem";
import { useAccount, useEnsName } from "wagmi";
import { formatUnits } from "viem";
import type { LucideIcon } from "lucide-react";
import { mainnet } from "wagmi/chains";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Stack,
  Field,
  Input,
  Badge,
  Span,
} from "@neynar/ui";
import { Send, UserRound, Coins } from "lucide-react";
import { ChainBadge } from "../chain-badge";
import { ExperimentalTransferUsdcButton } from "./experimental-transfer-usdc-button";
import { ExperimentalTransactionStatus } from "../experimental-transaction-status";
import { truncateAddress } from "../../helpers";
import {
  useUsdcBalanceOf,
  useUsdcDecimals,
} from "../../contracts/base/usdc/hooks";
import {
  useUser,
  useBulkUsersByAddress,
} from "../../../neynar/api-hooks/hooks";

/**
 * ExperimentalTransferUsdcCard - Complete USDC transfer card with recipient lookup and balance checking
 *
 * A self-contained transfer interface that handles the complete USDC payment flow:
 * - Recipient lookup by Farcaster ID or wallet address
 * - Displays Farcaster profiles (avatar, name, username) when available
 * - Falls back to ENS name or truncated address for wallet-only recipients
 * - Balance checking with insufficient funds warnings
 * - Amount input with optional lock
 * - Transaction lifecycle tracking (pending → confirming → success/error)
 *
 * @example
 * ```tsx
 * // Pay a Farcaster user by FID (number or string)
 * <ExperimentalTransferUsdcCard
 *   recipientFid={3}
 *   amountUsdc={10}
 *   onSuccess={(hash) => console.log("Payment sent:", hash)}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Pay a wallet address (shows ENS or truncated address)
 * <ExperimentalTransferUsdcCard
 *   recipientAddress="0x8E9bFa938E3631B9351A83DdA88C1f89d79E7585"
 *   amountUsdc={5}
 *   lockAmount={true}
 *   onSuccess={(hash) => console.log("Paid!")}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Custom title and icon with controlled amount
 * const [tipAmount, setTipAmount] = useState(1);
 * const currentUser = useFarcasterUser();
 *
 * <ExperimentalTransferUsdcCard
 *   title="Tip Creator"
 *   icon={Heart}
 *   recipientFid={currentUser.fid}  // Can use number directly
 *   amountUsdc={tipAmount}
 *   onSuccess={(hash) => showThankYou()}
 * />
 * ```
 */
type TransferUsdcCardBaseProps = {
  /** Card title - defaults to "Send" */
  title?: string;
  /** Icon component from lucide-react - defaults to Send */
  icon?: LucideIcon;
  /** Transfer amount in USDC - updates form when changed */
  amountUsdc?: number;
  /** If true, amount field becomes read-only */
  lockAmount?: boolean;
  /** Called when user confirms transaction in wallet */
  onPending?: () => void;
  /** Called when transaction is submitted to blockchain and being mined */
  onConfirming?: (hash: Address) => void;
  /** Called when transaction is successfully confirmed on blockchain */
  onSuccess?: (hash: Address) => void;
  /** Called if transaction fails at any stage */
  onError?: (error: Error) => void;
  /** Optional CSS classes for styling the card container */
  className?: string;
};

type RecipientProps =
  | {
      /** Recipient Farcaster ID - displays user profile (avatar, name, username) */
      recipientFid: number | string;
      recipientAddress?: never;
    }
  | {
      recipientFid?: never;
      /** Recipient wallet address - displays ENS name or truncated address */
      recipientAddress: Address;
    };

type ExperimentalTransferUsdcCardProps = TransferUsdcCardBaseProps &
  RecipientProps;

export function ExperimentalTransferUsdcCard({
  title = "Send",
  icon: Icon = Send,
  recipientFid,
  recipientAddress,
  amountUsdc: amountProp,
  lockAmount = false,
  onPending,
  onConfirming,
  onSuccess,
  onError,
  className,
}: ExperimentalTransferUsdcCardProps) {
  console.log("TransferUsdcCard rendered with:", {
    recipientFid,
    recipientAddress,
  });

  const { chain, address } = useAccount();
  const { data: balanceData } = useUsdcBalanceOf(address || "0x0");
  const { data: decimalsData } = useUsdcDecimals();

  // Fetch user data if recipientFid is provided
  const { data: recipientUserByFid } = useUser(
    recipientFid
      ? typeof recipientFid === "number"
        ? recipientFid
        : parseInt(recipientFid, 10)
      : 0,
    {},
    { enabled: !!recipientFid },
  );

  // Fetch user data if recipientAddress is provided (lookup by address)
  const { data: recipientUsersByAddress } = useBulkUsersByAddress(
    recipientAddress ? [recipientAddress] : [],
    undefined,
    {},
    { enabled: !!recipientAddress && !recipientFid },
  );

  // Fetch ENS name for the recipient address (as fallback if no Farcaster user found)
  // Normalize address to lowercase for ENS lookup
  const normalizedRecipientAddress = recipientAddress?.toLowerCase() as
    | Address
    | undefined;

  const { data: ensName } = useEnsName({
    address: normalizedRecipientAddress,
    chainId: mainnet.id,
    query: {
      enabled: !!normalizedRecipientAddress && !recipientFid,
    },
  });

  // Use the appropriate user data source
  const recipientUser = recipientUserByFid || recipientUsersByAddress?.[0];

  // Convert balance from wei to human-readable format
  const balance =
    balanceData && decimalsData
      ? parseFloat(formatUnits(balanceData, decimalsData))
      : undefined;

  // Local state for form inputs
  const [amount, setAmount] = useState(
    amountProp !== undefined ? amountProp.toString() : "",
  );
  const [txHash, setTxHash] = useState<Address | null>(null);

  // Sync amount with prop changes (allows programmatic control)
  useEffect(() => {
    if (amountProp !== undefined) {
      setAmount(amountProp.toString());
    }
  }, [amountProp]);

  // Determine the recipient address - either from prop or from user data
  const recipient =
    recipientAddress ||
    recipientUser?.verified_addresses?.eth_addresses?.[0] ||
    "";

  // Handle transaction confirmation
  const handleConfirming = (hash: Address) => {
    setTxHash(hash);
    if (onConfirming) onConfirming(hash);
  };

  // Handle transaction success
  const handleTransferSuccess = (hash: Address) => {
    setTxHash(hash);
    if (!lockAmount) setAmount("");
    if (onSuccess) onSuccess(hash);
  };

  // Handle transaction error
  const handleTransferError = (error: Error) => {
    setTxHash(null);
    if (onError) onError(error);
  };

  // Form validation
  const amountValue = parseFloat(amount) || 0;
  const isValidForm = recipient && amount && amountValue > 0;
  const insufficientBalance = balance !== undefined && amountValue > balance;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Coins className="size-5" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Stack spacing={4}>
          <div className="grid grid-cols-[16px_36px_1fr] gap-x-3 gap-y-4 items-center">
            {/* Send Row */}
            <Icon className="size-4" />
            <Span variant="detail" weight="bold" className="text-right">
              Send
            </Span>
            <div className="relative">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={lockAmount}
                className="pr-24"
              />
              {amount && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  {chain && <ChainBadge chain={chain} />}
                  <Badge variant="secondary">USDC</Badge>
                </div>
              )}
            </div>

            {/* To Row */}
            {(recipientFid || recipientAddress) && (
              <>
                <UserRound className="size-4" />
                <Span variant="detail" weight="bold" className="text-right">
                  To
                </Span>
                {recipientUser ? (
                  <Field className="space-0 gap-1">
                    <div className="flex items-center gap-2 px-2 py-1 border border-black/20 dark:border-white/5 rounded-md bg-black/10 dark:bg-white/1">
                      {recipientUser.pfp_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recipientUser.pfp_url}
                          alt={recipientUser.display_name}
                          className="size-6 rounded-full"
                        />
                      )}
                      <Stack spacing={0}>
                        <Stack spacing={1} direction="horizontal">
                          <Span variant="detail" weight="medium">
                            {recipientUser.display_name}
                          </Span>
                          <Span variant="microcopy" color="muted">
                            @{recipientUser.username}
                          </Span>
                        </Stack>
                        <Span variant="microcopy" color="muted">
                          {truncateAddress(recipient as Address)}
                        </Span>
                      </Stack>
                    </div>
                  </Field>
                ) : (
                  <div className="px-2 py-1 border rounded-md border-black/20 dark:border-white/5 bg-black/10 dark:bg-white/1">
                    {ensName ? (
                      <Stack spacing={0}>
                        <Span variant="detail" weight="medium">
                          {ensName}
                        </Span>
                        <Span variant="microcopy" color="muted">
                          {truncateAddress(recipientAddress as Address)}
                        </Span>
                      </Stack>
                    ) : (
                      <Span variant="detail" className="font-mono">
                        {truncateAddress(recipientAddress as Address)}
                      </Span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <ExperimentalTransferUsdcButton
            to={recipient as Address}
            amountUsdc={amountValue}
            onPending={onPending}
            onConfirming={handleConfirming}
            onSuccess={handleTransferSuccess}
            onError={handleTransferError}
            disabled={!isValidForm || insufficientBalance}
            className="w-full"
          >
            {insufficientBalance
              ? `Insufficient balance (${balance?.toFixed(2)} USDC available)`
              : "Send"}
          </ExperimentalTransferUsdcButton>

          {txHash && <ExperimentalTransactionStatus hash={txHash} />}
        </Stack>
      </CardContent>
    </Card>
  );
}
