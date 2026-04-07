"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Button,
  Card,
  CardContent,
  H3,
  P,
  Small,
  Skeleton,
  Stack,
} from "@neynar/ui";
import {
  useNftMint,
  useNftPreview,
  type NftMintResponse,
  type NftPreviewResponse,
} from "../../api-hooks/hooks/onchain";

export type NftPreviewMintFlowProps = {
  /** Farcaster user FID. Flow is auto-disabled when undefined. */
  fid?: number;
  /** Collection slug identifying which NFT collection to use */
  collectionSlug: string;
  /** Called after preview image is generated */
  onPreviewGenerated?: (result: NftPreviewResponse) => void;
  /** Called after successful mint */
  onSuccess?: (result: NftMintResponse) => void;
  /** Called on error (preview or mint) */
  onError?: (error: Error) => void;
  /** Disable the flow */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
};

/**
 * Two-step NFT flow: generate preview -> confirm & mint.
 *
 * States: idle -> generating (skeleton) -> previewing (image + confirm) -> minting -> success | error
 *
 * Requires `createNftPreviewHandler` at `app/api/nft/preview/route.ts`
 * and `createNftMintHandler` at `app/api/nft/mint/route.ts`.
 */
export function NftPreviewMintFlow({
  fid,
  collectionSlug,
  onPreviewGenerated,
  onSuccess,
  onError,
  disabled,
  className,
}: NftPreviewMintFlowProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<NftMintResponse | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useNftPreview();
  const mint = useNftMint();

  const isDisabled = !fid || disabled;

  function handleError(err: unknown) {
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
    setError(message);
    onError?.(new Error(message));
  }

  async function handleGenerate() {
    if (!fid) return;
    setPreviewUrl(null);
    setMintResult(null);
    setError(null);
    try {
      const result = await preview.mutateAsync({ fid, collectionSlug });
      setPreviewUrl(result.image_url);
      onPreviewGenerated?.(result);
    } catch (err) {
      handleError(err);
    }
  }

  async function handleMint() {
    if (!fid) return;
    setIsMinting(true);
    setError(null);
    try {
      const result = await mint.mutateAsync({ fid, collectionSlug });
      setMintResult(result);
      onSuccess?.(result);
    } catch (err) {
      handleError(err);
    } finally {
      setIsMinting(false);
    }
  }

  // Success state (preview-first is always single-token)
  const mintedToken = mintResult?.tokens[0];
  if (mintedToken) {
    return (
      <Card className={className}>
        <CardContent>
          <Stack direction="vertical" spacing={4}>
            {mintedToken.image_url && (
              <div className="relative w-full" style={{ aspectRatio: "1" }}>
                <Image
                  src={mintedToken.image_url}
                  alt={`NFT #${mintedToken.token_id}`}
                  fill
                  className="rounded-lg object-cover"
                />
              </div>
            )}
            <H3>Minted token #{mintedToken.token_id}</H3>
            {mintedToken.error && (
              <Small color="muted">{mintedToken.error}</Small>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // Generating state
  if (preview.isPending) {
    return (
      <Card className={className}>
        <CardContent>
          <Stack direction="vertical" spacing={4}>
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-md" />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // Preview state - show image with confirm
  if (previewUrl && !isMinting) {
    return (
      <Card className={className}>
        <CardContent>
          <Stack direction="vertical" spacing={4}>
            <div className="relative w-full" style={{ aspectRatio: "1" }}>
              <Image
                src={previewUrl}
                alt="NFT preview"
                fill
                className="rounded-lg object-cover"
              />
            </div>
            {error && <P color="destructive">{error}</P>}
            <Button variant="default" onClick={handleMint}>
              Mint
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // Minting state (after preview)
  if (isMinting) {
    return (
      <Card className={className}>
        <CardContent>
          <Stack direction="vertical" spacing={4}>
            {previewUrl && (
              <div className="relative w-full" style={{ aspectRatio: "1" }}>
                <Image
                  src={previewUrl}
                  alt="NFT preview"
                  fill
                  className="rounded-lg object-cover opacity-50"
                />
              </div>
            )}
            <Button variant="default" disabled>
              Minting...
            </Button>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // Idle state
  return (
    <Stack direction="vertical" spacing={4}>
      <Button
        variant="default"
        disabled={isDisabled}
        onClick={handleGenerate}
        className={className}
      >
        Generate Preview
      </Button>
      {error && <P color="destructive">{error}</P>}
    </Stack>
  );
}
