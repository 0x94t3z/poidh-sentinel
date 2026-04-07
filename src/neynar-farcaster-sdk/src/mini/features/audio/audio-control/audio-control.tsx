/**
 * AudioControl - Volume sliders component
 *
 * Provides volume sliders for SFX and Music using Jotai atoms.
 * Can be used in settings panels, game UIs, or anywhere audio controls are needed.
 *
 * Features:
 * - Separate volume sliders for SFX and music
 * - Automatic persistence via Jotai atoms
 * - Accessible with proper ARIA labels
 *
 * Usage:
 * ```tsx
 * import { AudioControl, MuteButton } from '@/neynar-farcaster-sdk/mini';
 *
 * // Just volume sliders
 * <AudioControl />
 *
 * // Use MuteButton separately if needed
 * <MuteButton />
 * ```
 */

"use client";

import { VolumeSliders } from "./volume-sliders";

type AudioControlProps = {
  /**
   * Optional className for custom styling
   */
  className?: string;
};

export function AudioControl({ className = "" }: AudioControlProps) {
  return <VolumeSliders className={className} />;
}
