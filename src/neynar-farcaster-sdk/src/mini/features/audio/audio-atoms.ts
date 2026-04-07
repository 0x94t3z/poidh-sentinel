/**
 * Audio State Management - Jotai Atoms
 *
 * Global audio state using Jotai for cross-component audio control.
 * These atoms are used by the useAudio hook and AudioControl component.
 *
 * Benefits of Jotai atoms:
 * - Global state accessible from any component
 * - Automatic localStorage persistence
 * - No prop drilling required
 * - Type-safe state management
 */

import { atomWithStorage } from "jotai/utils";

/**
 * Global mute state
 * Persisted to localStorage as 'game-audio-muted'
 */
export const isMutedAtom = atomWithStorage<boolean>("game-audio-muted", false);

/**
 * Sound effects volume (0.0 - 1.0)
 * Persisted to localStorage as 'game-sfx-volume'
 */
export const sfxVolumeAtom = atomWithStorage<number>("game-sfx-volume", 0.7);

/**
 * Music volume (0.0 - 1.0)
 * Persisted to localStorage as 'game-music-volume'
 */
export const musicVolumeAtom = atomWithStorage<number>(
  "game-music-volume",
  0.5,
);
