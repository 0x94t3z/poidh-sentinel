/**
 * MuteButton - Standalone mute toggle button
 *
 * Provides a standalone mute toggle button that controls all audio (both SFX and music).
 * State is automatically persisted using Jotai atoms.
 *
 * Features:
 * - Mutes/unmutes all audio
 * - Visual feedback with icons
 * - Accessible with proper ARIA labels
 * - Automatic persistence via Jotai atoms
 *
 * @example
 * ```tsx
 * import { MuteButton, AudioControl } from '@/neynar-farcaster-sdk/mini';
 *
 * // Just mute button
 * <MuteButton />
 *
 * // Combine with volume sliders
 * <div>
 *   <MuteButton />
 *   <AudioControl />
 * </div>
 * ```
 */

"use client";

import { useAtom } from "jotai";
import { Volume2, VolumeX } from "lucide-react";
import { isMutedAtom } from "../audio-atoms";
import { Button } from "@neynar/ui";

type MuteButtonProps = {
  /**
   * Optional className for custom styling
   */
  className?: string;
  /**
   * Optional children to show text label. If not provided, only icon is shown.
   */
  children?: React.ReactNode;
};

export function MuteButton({ className = "", children }: MuteButtonProps) {
  const [isMuted, setIsMuted] = useAtom(isMutedAtom);

  return (
    <Button
      variant="outline"
      size={children ? "sm" : "icon"}
      onClick={() => setIsMuted(!isMuted)}
      aria-label={isMuted ? "Unmute audio" : "Mute audio"}
      className={className}
    >
      {isMuted ? (
        <VolumeX className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
      {children && <span className="ml-2">{children}</span>}
    </Button>
  );
}
