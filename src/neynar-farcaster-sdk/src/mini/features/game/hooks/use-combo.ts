"use client";

import { atom, useAtom, useAtomValue } from "jotai";
import { atomEffect } from "jotai-effect";

/**
 * Global combo atoms
 * Shared across all components that use useCombo
 */
const comboAtom = atom<number>(0);
const comboTimeoutAtom = atom<ReturnType<typeof setTimeout> | null>(null);
const maxComboTimeAtom = atom<number>(1000); // Default 1 second

// Store multiplier function (takes combo count, returns multiplier)
// Wrapped in object to avoid Jotai treating it as an initializer
type MultiplierFn = (combo: number) => number;
const defaultMultiplierFn: MultiplierFn = (combo: number) => Math.max(1, combo);
const multiplierFnAtom = atom<{ fn: MultiplierFn }>({
  fn: defaultMultiplierFn,
});

/**
 * Singleton combo timeout effect
 * Manages the timeout cleanup globally so components can safely mount/unmount
 */
const comboTimeoutEffectAtom = atomEffect((get) => {
  const timeout = get(comboTimeoutAtom);

  // Cleanup function runs when effect re-evaluates or unmounts
  return () => {
    if (timeout) {
      clearTimeout(timeout);
    }
  };
});

/**
 * Combo multiplier system for consecutive actions (global)
 *
 * Tracks consecutive actions and builds a multiplier. Auto-resets if no action
 * occurs within the specified time window. State is shared globally across all
 * components that use this hook.
 *
 * ## Configuration
 * - `setMaxComboTime(ms)` - Set timeout window (default: 1000ms)
 * - `setMultiplierFn(fn)` - Customize multiplier calculation (default: linear)
 *
 * ## Multiplier Modes
 * - **Linear**: `(combo) => Math.max(1, combo)` - Multiplier equals combo count
 * - **Tiered**: Jumps at thresholds (e.g., 1x → 2x @5 → 3x @10)
 * - **Exponential**: Rapid growth with diminishing returns
 * - **Custom**: Any function mapping combo count to multiplier
 *
 * @returns Object with combo state and control functions
 *
 * @example Basic usage - Linear multiplier
 * ```typescript
 * const { combo, multiplier, addCombo, resetCombo } = useCombo();
 *
 * // Player performs action
 * addCombo();
 * const points = 10 * multiplier; // 10, 20, 30, 40...
 *
 * // Combo resets automatically after 1 second of inactivity
 * ```
 *
 * @example Configuration - Tiered multiplier
 * ```typescript
 * // In initialization (e.g., useInitializeGame)
 * const { setMaxComboTime, setMultiplierFn } = useCombo();
 *
 * setMaxComboTime(2000); // 2 second window between actions
 *
 * // Tiered multiplier: rewards sustained combos
 * setMultiplierFn((combo) => {
 *   if (combo < 5) return 1;   // 1x for combos 0-4
 *   if (combo < 10) return 2;  // 2x for combos 5-9
 *   if (combo < 20) return 3;  // 3x for combos 10-19
 *   return 5;                   // 5x for combos 20+
 * });
 * ```
 *
 * @example Exponential multiplier with cap
 * ```typescript
 * const { setMultiplierFn } = useCombo();
 *
 * // Exponential growth, capped at 10x
 * setMultiplierFn((combo) => Math.min(10, Math.floor(Math.pow(2, combo / 5))));
 * // combo 0-4:   1x
 * // combo 5-9:   2x
 * // combo 10-14: 4x
 * // combo 15-19: 8x
 * // combo 20+:   10x (capped)
 * ```
 *
 * @example Usage across multiple components
 * ```typescript
 * // Component A - Build combo
 * function GamePlay() {
 *   const { addCombo } = useCombo();
 *   return <button onClick={addCombo}>Hit!</button>;
 * }
 *
 * // Component B - Display combo (shares same state)
 * function ComboDisplay() {
 *   const { combo, multiplier } = useCombo();
 *   return <div>Combo: {combo} (x{multiplier})</div>;
 * }
 * ```
 */
export function useCombo() {
  const [combo, setCombo] = useAtom(comboAtom);
  const [comboTimeout, setComboTimeout] = useAtom(comboTimeoutAtom);
  const [maxComboTime, setMaxComboTime] = useAtom(maxComboTimeAtom);
  const [multiplierFnWrapper, setMultiplierFnWrapper] =
    useAtom(multiplierFnAtom);

  // Mount the timeout effect to manage cleanup globally
  useAtomValue(comboTimeoutEffectAtom);

  // Unwrap the function from the object
  const multiplierFn = multiplierFnWrapper.fn;
  const setMultiplierFn = (fn: MultiplierFn) => setMultiplierFnWrapper({ fn });

  function addCombo() {
    setCombo((prev: number) => prev + 1);

    // Clear existing timeout
    if (comboTimeout) {
      clearTimeout(comboTimeout);
    }

    // Set new timeout to reset combo
    const newTimeout = setTimeout(() => {
      setCombo(0);
      setComboTimeout(null);
    }, maxComboTime);

    setComboTimeout(newTimeout);
  }

  function resetCombo() {
    setCombo(0);
    if (comboTimeout) {
      clearTimeout(comboTimeout);
      setComboTimeout(null);
    }
  }

  // Calculate multiplier using custom function
  const multiplier = multiplierFn(combo);

  return {
    combo,
    multiplier,
    addCombo,
    resetCombo,
    setMaxComboTime,
    setMultiplierFn,
  };
}
