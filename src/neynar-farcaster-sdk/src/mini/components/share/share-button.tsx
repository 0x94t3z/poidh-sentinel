"use client";

import { useState } from "react";
import { Button } from "@neynar/ui";
import { useShare, type ShareOptions } from "./use-share";

export type ShareButtonProps = Omit<ShareOptions, "close"> & {
  /**
   * Button text to display.
   * @default "Share"
   */
  children?: React.ReactNode;
  /**
   * Additional CSS classes for the button.
   */
  className?: string;
  /**
   * Button variant from @neynar/ui.
   * @default "secondary"
   */
  variant?: "default" | "secondary" | "outline" | "ghost" | "link";
  /**
   * Button size from @neynar/ui.
   * @default "default"
   */
  size?: "default" | "sm" | "lg" | "icon";
  /**
   * Callback fired after successful share (cast was created).
   */
  onSuccess?: (castHash: string) => void;
  /**
   * Callback fired if user cancels or share fails.
   */
  onCancel?: () => void;
  /**
   * Whether the button is disabled.
   */
  disabled?: boolean;
};

/**
 * A button component for sharing the mini app on Farcaster.
 *
 * Uses `publicConfig.homeUrl` internally to ensure share URLs always point
 * to the production domain (*.neynar.app) rather than dev/preview URLs.
 *
 * @example
 * ```tsx
 * // Basic share button
 * <ShareButton text="Check out this app!" />
 *
 * // Share with personalized OG image (queryParams for dynamic share images)
 * <ShareButton
 *   text={`I scored ${score.toLocaleString()} points! 🎮`}
 *   queryParams={{ score: score.toString(), username }}
 * >
 *   Share Score
 * </ShareButton>
 * ```
 */
export function ShareButton({
  children = "Share",
  className,
  variant = "secondary",
  size = "default",
  text,
  path,
  queryParams,
  additionalEmbed,
  channelKey,
  onSuccess,
  onCancel,
  disabled,
}: ShareButtonProps) {
  const { share } = useShare();
  const [isSharing, setIsSharing] = useState(false);
  const shareQueryParams = {
    ...queryParams,
    share: "true",
  };

  async function handleClick() {
    if (isSharing || disabled) return;

    setIsSharing(true);
    try {
      const result = await share({
        text,
        path,
        queryParams: shareQueryParams,
        additionalEmbed,
        channelKey,
        close: false,
      });

      if (result.castHash) {
        onSuccess?.(result.castHash);
      } else {
        onCancel?.();
      }
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={disabled || isSharing}
    >
      {isSharing ? "Sharing..." : children}
    </Button>
  );
}
