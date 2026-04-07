/**
 * Sound Effect Registry
 *
 * Define sound effects declaratively using Tone.js instruments.
 * Similar to song definitions but for short, one-shot sounds.
 */

export type SfxInstrument =
  | "synth"
  | "noise"
  | "pluck"
  | "bass"
  | "fm"
  | "metal"
  | "membrane";

export type SfxNote = {
  instrument: SfxInstrument;
  note?: string;
  duration: string;
  delay?: number;
  config?: {
    oscillator?: string;
    volume?: number;
    envelope?: {
      attack?: number;
      decay?: number;
      sustain?: number;
      release?: number;
    };
  };
};

export type SfxDefinition = SfxNote[];

// Built-in sound effects registry
export const sfx = {
  coin: [
    { instrument: "synth" as const, note: "C5", duration: "0.1" },
    { instrument: "synth" as const, note: "E5", duration: "0.1", delay: 50 },
  ] as SfxDefinition,

  jump: [
    {
      instrument: "synth" as const,
      note: "G3",
      duration: "0.15",
      config: {
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.15 },
      },
    },
  ] as SfxDefinition,

  hit: [
    { instrument: "noise" as const, duration: "0.06" },
    { instrument: "bass" as const, note: "G2", duration: "0.05" },
  ] as SfxDefinition,

  powerup: [
    { instrument: "synth" as const, note: "C4", duration: "0.1" },
    { instrument: "synth" as const, note: "E4", duration: "0.1", delay: 80 },
    { instrument: "synth" as const, note: "G4", duration: "0.1", delay: 160 },
    { instrument: "synth" as const, note: "C5", duration: "0.1", delay: 240 },
  ] as SfxDefinition,

  explosion: [
    {
      instrument: "bass" as const,
      note: "A1",
      duration: "0.4",
      config: {
        oscillator: "square",
        volume: 3,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.4 },
      },
    },
    {
      instrument: "noise" as const,
      duration: "0.15",
      config: {
        envelope: { attack: 0.005, decay: 0.1, sustain: 0 },
      },
    },
    {
      instrument: "synth" as const,
      note: "G2",
      duration: "0.15",
      delay: 20,
      config: {
        oscillator: "square",
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      },
    },
  ] as SfxDefinition,

  click: [
    { instrument: "synth" as const, note: "C5", duration: "0.05" },
  ] as SfxDefinition,

  success: [
    {
      instrument: "synth" as const,
      note: "C4",
      duration: "0.25",
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "E4",
      duration: "0.25",
      delay: 20,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "G4",
      duration: "0.25",
      delay: 40,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "D4",
      duration: "0.25",
      delay: 140,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "F4",
      duration: "0.25",
      delay: 160,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "A4",
      duration: "0.25",
      delay: 180,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "E4",
      duration: "0.25",
      delay: 280,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "G4",
      duration: "0.25",
      delay: 300,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "B4",
      duration: "0.25",
      delay: 320,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "G4",
      duration: "0.25",
      delay: 420,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "B4",
      duration: "0.25",
      delay: 440,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "D5",
      duration: "0.25",
      delay: 460,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "C5",
      duration: "0.25",
      delay: 560,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "E5",
      duration: "0.25",
      delay: 580,
      config: { oscillator: "triangle" },
    },
    {
      instrument: "synth" as const,
      note: "G5",
      duration: "0.25",
      delay: 600,
      config: { oscillator: "triangle" },
    },
  ] as SfxDefinition,

  failure: [
    { instrument: "synth" as const, note: "E4", duration: "0.2" },
    { instrument: "synth" as const, note: "Eb4", duration: "0.2", delay: 150 },
    { instrument: "synth" as const, note: "D4", duration: "0.2", delay: 300 },
    { instrument: "synth" as const, note: "C4", duration: "0.2", delay: 450 },
  ] as SfxDefinition,

  menuSelect: [
    { instrument: "pluck" as const, note: "C5", duration: "0.1" },
  ] as SfxDefinition,
} as const;
