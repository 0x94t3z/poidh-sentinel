/**
 * useSfx - Sound effects hook with 9 built-in effects
 *
 * Provides programmatic sound effect playback using Tone.js with 7 instruments.
 * Includes 9 pre-built sound effects and supports custom sound creation.
 *
 * Features:
 * - Automatic Tone.js initialization on first play
 * - 9 built-in effects: coin, jump, hit, powerup, explosion, click, success, failure, menuSelect
 * - 7 SFX instruments: synth, noise, pluck, bass, fm, metal, membrane
 * - Declarative sound effect definitions
 * - Automatic volume control via global audio atoms
 *
 * @example
 * ```tsx
 * import { useSfx, sfx } from '@/neynar-farcaster-sdk/mini';
 *
 * function MyGame() {
 *   const sfxPlayer = useSfx();
 *
 *   const handleCoin = () => sfxPlayer.play(sfx.coin);
 *   const handleJump = () => sfxPlayer.play(sfx.jump);
 *
 *   return (
 *     <div>
 *       <button onClick={handleCoin}>Collect Coin</button>
 *       <button onClick={handleJump}>Jump</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Custom sound effects (in src/features/audio/custom-sfx.ts)
 * ```tsx
 * import type { SfxDefinition } from '@/neynar-farcaster-sdk/mini';
 *
 * export const laserShot: SfxDefinition = [
 *   {
 *     instrument: "fm",
 *     note: "E6",
 *     duration: "0.15",
 *     config: {
 *       envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
 *     },
 *   },
 * ];
 * ```
 *
 * @returns Object with play method for sound effects
 */

"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAtom } from "jotai";
import * as Tone from "tone";
import { isMutedAtom, sfxVolumeAtom } from "./audio-atoms";
import type { SfxDefinition, SfxNote } from "./sfx-registry";

class SFXPlayer {
  private instruments: {
    synth: Tone.Synth;
    noise: Tone.NoiseSynth;
    pluck: Tone.PluckSynth;
    bass: Tone.MonoSynth;
    fm: Tone.FMSynth;
    metal: Tone.MetalSynth;
    membrane: Tone.MembraneSynth;
  };
  private sfxVolume: number = 0.7;
  private isMuted: boolean = false;

  constructor(sfxVolume: number = 0.7, isMuted: boolean = false) {
    this.sfxVolume = sfxVolume;
    this.isMuted = isMuted;

    this.instruments = {
      synth: new Tone.Synth().toDestination(),
      noise: new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0 },
      }).toDestination(),
      pluck: new Tone.PluckSynth().toDestination(),
      bass: new Tone.MonoSynth({
        oscillator: { type: "square" },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.4 },
        filter: {
          type: "lowpass",
          frequency: 200,
          rolloff: -24,
        },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.2,
          sustain: 0,
          baseFrequency: 200,
          octaves: 2,
        },
      }).toDestination(),
      fm: new Tone.FMSynth().toDestination(),
      metal: new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 0.4, release: 0.2 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).toDestination(),
      membrane: new Tone.MembraneSynth().toDestination(),
    };

    this.updateVolumes();
  }

  private updateVolumes() {
    if (this.isMuted || this.sfxVolume === 0) {
      Object.values(this.instruments).forEach((inst) => {
        inst.volume.value = -Infinity;
      });
      return;
    }

    const dB = this.sfxVolume * 10 - 5;
    Object.values(this.instruments).forEach((inst) => {
      inst.volume.value = dB;
    });
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = volume;
    this.updateVolumes();
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.updateVolumes();
  }

  private hasOscillator(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inst: any,
  ): inst is Tone.Synth | Tone.MonoSynth | Tone.FMSynth {
    return "oscillator" in inst;
  }

  private hasEnvelope(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inst: any,
  ): inst is
    | Tone.Synth
    | Tone.MonoSynth
    | Tone.FMSynth
    | Tone.NoiseSynth
    | Tone.MembraneSynth
    | Tone.MetalSynth {
    return "envelope" in inst;
  }

  private playNote(noteData: SfxNote) {
    const instrument = this.instruments[noteData.instrument];
    const delay = noteData.delay || 0;

    const playSfx = () => {
      if (noteData.config) {
        const originalSettings: {
          oscillator?: { type: string };
          envelope?: Partial<Tone.EnvelopeOptions>;
          volume: number;
        } = {
          volume: instrument.volume.value,
        };

        // Save original settings
        if (this.hasOscillator(instrument)) {
          originalSettings.oscillator = instrument.get().oscillator;
        }
        if (this.hasEnvelope(instrument)) {
          originalSettings.envelope = instrument.get().envelope;
        }

        // Apply config overrides
        if (noteData.config.oscillator && this.hasOscillator(instrument)) {
          instrument.oscillator.type = noteData.config
            .oscillator as Tone.ToneOscillatorType;
        }
        if (noteData.config.envelope && this.hasEnvelope(instrument)) {
          instrument.envelope.set(noteData.config.envelope);
        }
        if (noteData.config.volume !== undefined) {
          instrument.volume.value = noteData.config.volume;
        }

        // Play the note
        if (noteData.note) {
          instrument.triggerAttackRelease(noteData.note, noteData.duration);
        } else {
          // Noise synth doesn't take a note parameter
          if (noteData.instrument === "noise") {
            (instrument as Tone.NoiseSynth).triggerAttackRelease(
              noteData.duration,
            );
          }
        }

        // Restore original settings
        setTimeout(
          () => {
            if (originalSettings.oscillator && this.hasOscillator(instrument)) {
              instrument.oscillator.type = originalSettings.oscillator
                .type as Tone.ToneOscillatorType;
            }
            if (originalSettings.envelope && this.hasEnvelope(instrument)) {
              instrument.envelope.set(originalSettings.envelope);
            }
            instrument.volume.value = originalSettings.volume;
          },
          Tone.Time(noteData.duration).toMilliseconds() + 100,
        );
      } else {
        if (noteData.note) {
          instrument.triggerAttackRelease(noteData.note, noteData.duration);
        } else {
          // Noise synth doesn't take a note parameter
          if (noteData.instrument === "noise") {
            (instrument as Tone.NoiseSynth).triggerAttackRelease(
              noteData.duration,
            );
          }
        }
      }
    };

    if (delay > 0) {
      setTimeout(playSfx, delay);
    } else {
      playSfx();
    }
  }

  play(sfx: SfxDefinition) {
    sfx.forEach((note) => this.playNote(note));
  }

  dispose() {
    Object.values(this.instruments).forEach((inst) => inst.dispose());
  }
}

let sfxPlayer: SFXPlayer | null = null;
let initialized = false;

export function useSfx() {
  const [isMuted] = useAtom(isMutedAtom);
  const [sfxVolume] = useAtom(sfxVolumeAtom);
  const isInitializing = useRef(false);

  const init = useCallback(async () => {
    if (initialized || isInitializing.current) return;

    isInitializing.current = true;
    await Tone.start();
    sfxPlayer = new SFXPlayer(sfxVolume, isMuted);
    initialized = true;
    isInitializing.current = false;
  }, [sfxVolume, isMuted]);

  useEffect(() => {
    if (sfxPlayer) {
      sfxPlayer.setSfxVolume(sfxVolume);
    }
  }, [sfxVolume]);

  useEffect(() => {
    if (sfxPlayer) {
      sfxPlayer.setMuted(isMuted);
    }
  }, [isMuted]);

  useEffect(() => {
    return () => {
      if (sfxPlayer) {
        sfxPlayer.dispose();
        sfxPlayer = null;
        initialized = false;
      }
    };
  }, []);

  return {
    init,
    play: async (sfx: SfxDefinition) => {
      await init();
      sfxPlayer?.play(sfx);
    },
  };
}
