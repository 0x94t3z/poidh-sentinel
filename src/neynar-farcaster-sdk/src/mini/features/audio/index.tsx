/**
 * Audio Features Module
 *
 * Complete audio system for Farcaster mini apps including sound effects and music synthesis.
 */

// Main hooks
export { useSfx } from "./use-sfx";
export {
  useSong,
  type SongSection,
  type SongDefinition,
  type InstrumentConfig,
  type NoteValue,
  type MusicEntry,
  type NoteEntry,
  type ChordEntry,
  type RestEntry,
  type NoteDuration,
  type OscillatorType,
} from "./use-song";

// UI Components
export { AudioControl } from "./audio-control/audio-control";
export { MuteButton } from "./audio-control/mute-button";

// Built-in sound effects registry
export { sfx, type SfxDefinition } from "./sfx-registry";

// State atoms (for advanced usage)
export { isMutedAtom, sfxVolumeAtom, musicVolumeAtom } from "./audio-atoms";
