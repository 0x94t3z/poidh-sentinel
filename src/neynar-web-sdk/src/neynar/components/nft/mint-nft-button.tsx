"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  Button,
  Card,
  CardContent,
  H3,
  Small,
  Skeleton,
  Stack,
} from "@neynar/ui";
import {
  useNftMint,
  type NftMintResponse,
} from "../../api-hooks/hooks/onchain";

export type NftMintButtonProps = {
  /** Farcaster user FID. Button is auto-disabled when undefined. */
  fid?: number;
  /** Collection slug identifying which NFT collection to mint from */
  collectionSlug: string;
  /** Number of tokens to mint (default: 1) */
  quantity?: number;
  /** Called after successful mint */
  onSuccess?: (result: NftMintResponse) => void;
  /** Called on mint error */
  onError?: (error: Error) => void;
  /** Disable the button */
  disabled?: boolean;
  /** Button variant */
  variant?: "default" | "secondary" | "outline" | "ghost";
  /** Additional CSS classes */
  className?: string;
  /** Custom button content. Defaults to "Mint NFT" */
  children?: ReactNode;
};

/**
 * One-click NFT mint button. Calls `POST /api/nft/mint` via `useNftMint`.
 *
 * States: idle -> minting (skeleton) -> success (shows minted image) | error
 *
 * Requires `createNftMintHandler` at `app/api/nft/mint/route.ts`.
 */
export function NftMintButton({
  fid,
  collectionSlug,
  quantity,
  onSuccess,
  onError,
  disabled,
  variant = "default",
  className,
  children,
}: NftMintButtonProps) {
  const [mintResult, setMintResult] = useState<NftMintResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mint = useNftMint();

  const isDisabled = !fid || disabled || mint.isPending;

  async function handleMint() {
    if (!fid) return;
    setErrorMessage(null);
    try {
      const result = await mint.mutateAsync({ fid, collectionSlug, quantity });
      setMintResult(result);
      onSuccess?.(result);
    } catch (err) {
      let message: string;
      if (err instanceof Error) {
        message = err.message;
      } else if (typeof err === "string") {
        message = err;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        message = String((err as { message: unknown }).message);
      } else {
        message = "An unexpected error occurred";
      }
      setErrorMessage(message);
      onError?.(new Error(message));
    }
  }

  if (mint.isPending) {
    return (
      <Card className={className}>
        <CardContent>
          <Stack direction="vertical" spacing={4}>
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-6 w-48" />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (mintResult) {
    const tokens = mintResult.tokens;
    const errors = tokens.filter((t) => t.error);
    return (
      <Card className={className}>
        <CardContent>
          <Stack direction="vertical" spacing={4}>
            {tokens.map((token) => (
              <Stack key={token.token_id} direction="vertical" spacing={2}>
                {token.image_url && (
                  <div className="relative w-full" style={{ aspectRatio: "1" }}>
                    <Image
                      src={token.image_url}
                      alt={`NFT #${token.token_id}`}
                      fill
                      className="rounded-lg object-cover"
                    />
                  </div>
                )}
                <H3>Token #{token.token_id}</H3>
              </Stack>
            ))}
            {errors.length > 0 && (
              <Small color="muted">
                {errors.length} token(s) failed image/metadata upload
              </Small>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack direction="vertical" spacing={2}>
      <Button
        variant={variant}
        disabled={isDisabled}
        className={className}
        onClick={handleMint}
      >
        {children ?? "Mint NFT"}
      </Button>
      {errorMessage && <Small color="muted">{errorMessage}</Small>}
    </Stack>
  );
}
