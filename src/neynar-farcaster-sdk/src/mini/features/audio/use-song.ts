"use client";

/**
 * useSong - Declarative music creation with section-based composition
 *
 * Create background music declaratively using Tone.js with 10 instruments.
 * Define songs as data structures with sections (intro, verse, chorus, etc.).
 *
 * Features:
 * - 10 instruments: melody, bassLine, chords, drums, arp, duo, am, fx, metal, noise
 * - Section-based song structure (intro, verse, chorus, bridge, outro)
 * - Per-section instrument configuration
 * - Automatic Tone.js initialization
 * - Loop support with configurable repeat counts
 * - Automatic volume control via global audio atoms
 *
 * @example Basic usage (define in src/features/audio/theme-song.ts)
 * ```tsx
 * import { useSong } from '@/neynar-farcaster-sdk/mini';
 * import type { SongDefinition } from '@/neynar-farcaster-sdk/mini';
 *
 * export const themeSong: SongDefinition = {
 *   bpm: 120,
 *   sections: {
 *     intro: {
 *       melody: ["C4", "E4", "G4", "C5"],
 *       drums: ["kick", null, "snare", null],
 *     },
 *     verse: {
 *       melody: ["C4", "D4", "E4", "F4", "G4", "A4", "G4", "F4"],
 *       bassLine: ["C2", "C2", "G2", "G2"],
 *       chords: [["C4", "E4", "G4"], null, ["G3", "B3", "D4"], null],
 *       drums: ["kick", null, "snare", null],
 *     },
 *   },
 *   sequence: ["intro", "verse", "verse"],
 * };
 *
 * function MyGame() {
 *   const { play, stop, isPlaying } = useSong(themeSong);
 *
 *   return (
 *     <button onClick={() => isPlaying ? stop() : play()}>
 *       {isPlaying ? 'Stop Music' : 'Play Music'}
 *     </button>
 *   );
 * }
 * ```
 *
 * @param songDefinition - Song definition with BPM, sections, and sequence
 * @returns Object with play, stop, and isPlaying controls
 */

import { useEffect, useRef } from "react";
import * as Tone from "tone";
import { isMutedAtom, musicVolumeAtom } from "./audio-atoms";
import { useAtom } from "jotai";

export type NoteValue = Tone.Unit.Frequency;
export type NoteDuration = "8n" | "4n" | "16n" | "2n" | "1n";
export type OscillatorType = "sine" | "square" | "sawtooth" | "triangle";

// Single note: ["C4", "4n"]
export type NoteEntry = [NoteValue, NoteDuration];

// Chord: [["C4", "E4", "G4"], "4n"]
export type ChordEntry = [NoteValue[], NoteDuration];

// Rest (silent pause): ["rest", "4n"]
export type RestEntry = ["rest", NoteDuration];

// Can be a note, chord, or rest
export type MusicEntry = NoteEntry | ChordEntry | RestEntry;

/**
 * Optional instrument configuration for customizing sound per section
 */
export type InstrumentConfig = {
  oscillator?: OscillatorType;
  volume?: number; // -20 to +10 dB
  envelope?: {
    attack?: number;
    decay?: number;
    sustain?: number;
    release?: number;
  };
};

/**
 * A song section containing musical parts for different instruments
 *
 * Available instruments:
 * - melody: Lead synth - plays single notes or chords
 * - bassLine: Bass synth with lowpass filter - plays single notes
 * - chords: Pad synth (polyphonic) - plays chords
 * - arp: Arpeggiated synth with pluck sound - plays single notes
 * - fx: FM synth for atmospheric/bell-like sounds - plays single notes
 * - noise: Pure noise synth for atmospheric effects - plays durations only (note value ignored)
 * - drums: Membrane synth - automatic patterns based on drumPattern
 * - metal: Metallic/bell-like synth for shimmering, inharmonic sounds - plays single notes
 * - am: Amplitude modulation synth for complex, evolving timbres - plays single notes
 * - duo: Two-voice harmonizing synth for rich, layered sounds - plays single notes
 *
 * Each instrument can be customized per section with optional config
 */
export type SongSection = {
  melody?: MusicEntry[];
  bassLine?: (NoteEntry | RestEntry)[];
  chords?: (ChordEntry | RestEntry)[];
  arp?: (NoteEntry | RestEntry)[]; // Arpeggiated pluck synth
  fx?: (NoteEntry | RestEntry)[]; // FM synth for tonal atmospheric sounds
  noise?: (NoteEntry | RestEntry)[]; // Pure noise (note value ignored, only duration used)
  metal?: (NoteEntry | RestEntry)[]; // Metallic synth for bell-like, shimmering sounds
  am?: (NoteEntry | RestEntry)[]; // AM synth for complex, evolving timbres
  duo?: (NoteEntry | RestEntry)[]; // Duo synth for harmonized, layered sounds
  drumPattern?: "simple" | "complex" | "heavy" | "none";
  tempo?: number; // BPM for this section (overrides song-level tempo)

  // Optional per-section instrument customization
  config?: {
    melody?: InstrumentConfig;
    bassLine?: InstrumentConfig;
    chords?: InstrumentConfig;
    arp?: InstrumentConfig;
    fx?: InstrumentConfig;
    noise?: InstrumentConfig;
    metal?: InstrumentConfig;
    am?: InstrumentConfig;
    duo?: InstrumentConfig;
  };
};

/**
 * Complete song definition with named sections and playback order
 *
 * Example:
 * ```typescript
 * const song: SongDefinition = {
 *   sections: {
 *     intro: { melody: [["C4", "4n"]], bassLine: [], chords: [], drumPattern: "none" },
 *     verse: { melody: [["C4", "8n"], ["D4", "8n"]], bassLine: [["C2", "4n"]], chords: [], drumPattern: "simple" }
 *   },
 *   structure: ["intro", "verse", "verse", "intro"],
 *   tempo: 120  // BPM (beats per minute), default: 120
 * };
 * ```
 */
export type SongDefinition = {
  sections: Record<string, SongSection>;
  structure: string[]; // Section names in order
  tempo?: number; // BPM (beats per minute), default: 120
};

class SongPlayer {
  private lead: Tone.Synth;
  private bass: Tone.MonoSynth;
  private pad: Tone.PolySynth;
  private arp: Tone.PluckSynth;
  private fx: Tone.FMSynth;
  private noise: Tone.NoiseSynth;
  private drums: Tone.MembraneSynth;
  private metal: Tone.MetalSynth;
  private am: Tone.AMSynth;
  private duo: Tone.DuoSynth;
  private isPlaying = false;
  private musicVolume = 0.5;
  private isMuted = false;

  constructor() {
    this.lead = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();

    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 0.8 },
      filter: { Q: 2, type: "lowpass", rolloff: -24 },
    }).toDestination();

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 2 },
    }).toDestination();

    this.arp = new Tone.PluckSynth({
      attackNoise: 1,
      dampening: 4000,
      resonance: 0.9,
    }).toDestination();

    this.fx = new Tone.FMSynth({
      harmonicity: 3,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 1 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.2, decay: 0, sustain: 1, release: 0.5 },
    }).toDestination();

    this.noise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0 },
    }).toDestination();

    this.drums = new Tone.MembraneSynth().toDestination();

    this.metal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.4, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).toDestination();

    this.am = new Tone.AMSynth({
      harmonicity: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 1 },
      modulation: { type: "square" },
      modulationEnvelope: { attack: 0.5, decay: 0, sustain: 1, release: 0.5 },
    }).toDestination();

    this.duo = new Tone.DuoSynth({
      vibratoAmount: 0.5,
      vibratoRate: 5,
      harmonicity: 1.5,
      voice0: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 1 },
      },
      voice1: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 1 },
      },
    }).toDestination();

    this.updateVolumes();
  }

  private updateVolumes() {
    if (this.isMuted || this.musicVolume === 0) {
      this.lead.volume.value = -Infinity;
      this.bass.volume.value = -Infinity;
      this.pad.volume.value = -Infinity;
      this.arp.volume.value = -Infinity;
      this.fx.volume.value = -Infinity;
      this.noise.volume.value = -Infinity;
      this.drums.volume.value = -Infinity;
      this.metal.volume.value = -Infinity;
      this.am.volume.value = -Infinity;
      this.duo.volume.value = -Infinity;
      return;
    }
    const dB = this.musicVolume * 10 - 15;
    this.lead.volume.value = dB;
    this.bass.volume.value = dB;
    this.pad.volume.value = dB;
    this.arp.volume.value = dB - 3;
    this.fx.volume.value = dB - 5;
    this.noise.volume.value = dB - 8;
    this.drums.volume.value = dB + 3;
    this.metal.volume.value = dB - 2;
    this.am.volume.value = dB - 1;
    this.duo.volume.value = dB;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyInstrumentConfig(synth: any, config?: InstrumentConfig) {
    if (!config) return;

    if (config.oscillator && synth.oscillator) {
      synth.oscillator.type = config.oscillator;
    }

    if (config.volume !== undefined) {
      const basedB =
        this.isMuted || this.musicVolume === 0
          ? -Infinity
          : this.musicVolume * 10 - 15;
      synth.volume.value = basedB + config.volume;
    }

    if (config.envelope && synth.envelope) {
      const envelope = synth.envelope;
      if (config.envelope.attack !== undefined)
        envelope.attack = config.envelope.attack;
      if (config.envelope.decay !== undefined)
        envelope.decay = config.envelope.decay;
      if (config.envelope.sustain !== undefined)
        envelope.sustain = config.envelope.sustain;
      if (config.envelope.release !== undefined)
        envelope.release = config.envelope.release;
    }
  }

  setMusicVolume(volume: number) {
    this.musicVolume = volume;
    this.updateVolumes();
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.updateVolumes();
  }

  private isChord(entry: MusicEntry): entry is ChordEntry {
    return Array.isArray(entry) && Array.isArray(entry[0]);
  }

  private isRest(entry: MusicEntry): entry is RestEntry {
    return Array.isArray(entry) && entry[0] === "rest";
  }

  private async playSection(
    section: SongSection,
    startTime: number,
  ): Promise<number> {
    // Apply per-section tempo if specified
    if (section.tempo !== undefined) {
      Tone.getTransport().bpm.value = section.tempo;
    }

    // Apply per-section instrument configs
    if (section.config) {
      if (section.config.melody)
        this.applyInstrumentConfig(this.lead, section.config.melody);
      if (section.config.bassLine)
        this.applyInstrumentConfig(this.bass, section.config.bassLine);
      if (section.config.chords)
        this.applyInstrumentConfig(this.pad, section.config.chords);
      if (section.config.arp)
        this.applyInstrumentConfig(this.arp, section.config.arp);
      if (section.config.fx)
        this.applyInstrumentConfig(this.fx, section.config.fx);
      if (section.config.noise)
        this.applyInstrumentConfig(this.noise, section.config.noise);
      if (section.config.metal)
        this.applyInstrumentConfig(this.metal, section.config.metal);
      if (section.config.am)
        this.applyInstrumentConfig(this.am, section.config.am);
      if (section.config.duo)
        this.applyInstrumentConfig(this.duo, section.config.duo);
    }

    const melodyDuration = section.melody
      ? this.calculateTotalDuration(section.melody)
      : 0;
    const bassDuration = section.bassLine
      ? this.calculateTotalDuration(section.bassLine)
      : 0;
    const chordDuration = section.chords
      ? this.calculateTotalDuration(section.chords)
      : 0;
    const arpDuration = section.arp
      ? this.calculateTotalDuration(section.arp)
      : 0;
    const fxDuration = section.fx ? this.calculateTotalDuration(section.fx) : 0;
    const noiseDuration = section.noise
      ? this.calculateTotalDuration(section.noise)
      : 0;
    const metalDuration = section.metal
      ? this.calculateTotalDuration(section.metal)
      : 0;
    const amDuration = section.am ? this.calculateTotalDuration(section.am) : 0;
    const duoDuration = section.duo
      ? this.calculateTotalDuration(section.duo)
      : 0;
    const sectionDuration = Math.max(
      melodyDuration,
      bassDuration,
      chordDuration,
      arpDuration,
      fxDuration,
      noiseDuration,
      metalDuration,
      amDuration,
      duoDuration,
    );

    // Schedule melody (can be notes, chords, or rests)
    if (section.melody) {
      let melodyTime = startTime;
      for (const entry of section.melody) {
        if (this.isRest(entry)) {
          // Rest note - just advance time without playing
          melodyTime += Tone.Time(entry[1]).toSeconds();
        } else if (this.isChord(entry)) {
          const [notes, duration] = entry;
          this.pad.triggerAttackRelease(notes, duration, melodyTime);
          melodyTime += Tone.Time(duration).toSeconds();
        } else {
          const [note, duration] = entry;
          this.lead.triggerAttackRelease(note, duration, melodyTime);
          melodyTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule bass
    if (section.bassLine) {
      let bassTime = startTime;
      for (const entry of section.bassLine) {
        if (this.isRest(entry)) {
          bassTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [note, duration] = entry;
          this.bass.triggerAttackRelease(note, duration, bassTime);
          bassTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule chords
    if (section.chords) {
      let chordTime = startTime;
      for (const entry of section.chords) {
        if (this.isRest(entry)) {
          chordTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [notes, duration] = entry;
          this.pad.triggerAttackRelease(notes, duration, chordTime);
          chordTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule arp
    if (section.arp) {
      let arpTime = startTime;
      for (const entry of section.arp) {
        if (this.isRest(entry)) {
          arpTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [note, duration] = entry;
          this.arp.triggerAttackRelease(note, duration, arpTime);
          arpTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule fx
    if (section.fx) {
      let fxTime = startTime;
      for (const entry of section.fx) {
        if (this.isRest(entry)) {
          fxTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [note, duration] = entry;
          this.fx.triggerAttackRelease(note, duration, fxTime);
          fxTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule noise
    if (section.noise) {
      let noiseTime = startTime;
      for (const entry of section.noise) {
        if (this.isRest(entry)) {
          noiseTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [, duration] = entry;
          this.noise.triggerAttackRelease(duration, noiseTime);
          noiseTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule metal
    if (section.metal) {
      let metalTime = startTime;
      for (const entry of section.metal) {
        if (this.isRest(entry)) {
          metalTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [, duration] = entry;
          this.metal.triggerAttackRelease(duration, metalTime);
          metalTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule am
    if (section.am) {
      let amTime = startTime;
      for (const entry of section.am) {
        if (this.isRest(entry)) {
          amTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [note, duration] = entry;
          this.am.triggerAttackRelease(note, duration, amTime);
          amTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule duo
    if (section.duo) {
      let duoTime = startTime;
      for (const entry of section.duo) {
        if (this.isRest(entry)) {
          duoTime += Tone.Time(entry[1]).toSeconds();
        } else {
          const [note, duration] = entry;
          this.duo.triggerAttackRelease(note, duration, duoTime);
          duoTime += Tone.Time(duration).toSeconds();
        }
      }
    }

    // Schedule drums
    if (
      section.drumPattern === "simple" ||
      section.drumPattern === "complex" ||
      section.drumPattern === "heavy"
    ) {
      const beatsInSection = Math.ceil(
        sectionDuration / Tone.Time("4n").toSeconds(),
      );
      for (let beat = 0; beat < beatsInSection; beat++) {
        const beatTime = startTime + beat * Tone.Time("4n").toSeconds();

        // Kick drum on 1 and 3
        if (beat % 4 === 0) {
          this.drums.triggerAttackRelease("C2", "8n", beatTime);
        }
        // Snare on 2 and 4
        if (beat % 4 === 2) {
          this.drums.triggerAttackRelease("E3", "16n", beatTime);
        }

        // Complex: Hi-hat on off-beats
        if (section.drumPattern === "complex" && beat % 2 === 1) {
          this.drums.triggerAttackRelease("G3", "32n", beatTime);
        }

        // Heavy: Double kick drums + constant hi-hats + extra snare hits
        if (section.drumPattern === "heavy") {
          // Double kick on every beat
          if (beat % 2 === 0) {
            this.drums.triggerAttackRelease("C2", "16n", beatTime + 0.125);
          }
          // Hi-hat on every eighth note
          this.drums.triggerAttackRelease("G3", "32n", beatTime);
          this.drums.triggerAttackRelease("G3", "32n", beatTime + 0.125);
          // Extra snare hits for intensity
          if (beat % 4 === 3) {
            this.drums.triggerAttackRelease("E3", "32n", beatTime);
          }
        }
      }
    }

    return startTime + sectionDuration;
  }

  private calculateTotalDuration(
    entries: (MusicEntry | NoteEntry | ChordEntry | RestEntry)[],
  ): number {
    return entries.reduce((total, entry) => {
      return total + Tone.Time(entry[1]).toSeconds();
    }, 0);
  }

  async play(song: SongDefinition) {
    if (this.isPlaying) {
      this.stop();
    }

    this.isPlaying = true;
    await Tone.start();

    // Set tempo if provided, default to 120 BPM
    const bpm = song.tempo ?? 120;
    Tone.getTransport().bpm.value = bpm;

    Tone.getTransport().start();

    const playLoop = async () => {
      let currentTime = Tone.now() + 0.1;

      for (const sectionName of song.structure) {
        if (!this.isPlaying) break;
        const section = song.sections[sectionName];
        if (!section) {
          console.warn(`Section "${sectionName}" not found in song definition`);
          continue;
        }
        currentTime = await this.playSection(section, currentTime);
      }

      if (this.isPlaying) {
        const nextLoopDelay = (currentTime - Tone.now() + 0.5) * 1000;
        setTimeout(playLoop, nextLoopDelay);
      }
    };

    playLoop();
  }

  stop() {
    this.isPlaying = false;
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
  }

  dispose() {
    this.stop();
    this.lead.dispose();
    this.bass.dispose();
    this.pad.dispose();
    this.arp.dispose();
    this.fx.dispose();
    this.noise.dispose();
    this.drums.dispose();
    this.metal.dispose();
    this.am.dispose();
    this.duo.dispose();
  }
}

let songPlayer: SongPlayer | null = null;

export function useSong() {
  const [isMuted] = useAtom(isMutedAtom);
  const [musicVolume] = useAtom(musicVolumeAtom);
  const playerRef = useRef<SongPlayer | null>(null);

  useEffect(() => {
    if (!songPlayer) {
      songPlayer = new SongPlayer();
    }
    playerRef.current = songPlayer;

    return () => {
      // Don't dispose on unmount, keep it alive
    };
  }, []);

  useEffect(() => {
    if (songPlayer) {
      songPlayer.setMusicVolume(musicVolume);
    }
  }, [musicVolume]);

  useEffect(() => {
    if (songPlayer) {
      songPlayer.setMuted(isMuted);
    }
  }, [isMuted]);

  const play = (song: SongDefinition) => {
    if (playerRef.current) {
      playerRef.current.play(song);
    }
  };

  const stop = () => {
    if (playerRef.current) {
      playerRef.current.stop();
    }
  };

  return { play, stop };
}
