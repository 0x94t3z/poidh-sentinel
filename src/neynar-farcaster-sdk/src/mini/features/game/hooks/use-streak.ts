"use client";

import { atom, useAtom } from "jotai";

/**
 * Global streak atoms
 * Shared across all components that use useStreak
 */
const streakAtom = atom<number>(0);
const bestStreakAtom = atom<number>(0);

/**
 * Win streak tracking hook (global)
 *
 * Tracks current win streak and best streak ever achieved using Jotai atoms.
 * Wins increment the streak, losses reset it to 0.
 *
 * @returns Object with streak values and manipulation functions
 *
 * @example
 * ```typescript
 * const { streak, bestStreak, addWin, addLoss, resetStreak } = useStreak();
 *
 * // Player wins a round
 * if (playerWon) {
 *   addWin(); // streak increments
 * } else {
 *   addLoss(); // streak resets to 0, bestStreak preserved
 * }
 *
 * // Display: "Current: {streak} | Best: {bestStreak}"
 *
 * // Reset everything
 * resetStreak(); // Both streak and bestStreak become 0
 * ```
 */
export function useStreak() {
  const [streak, setStreak] = useAtom(streakAtom);
  const [bestStreak, setBestStreak] = useAtom(bestStreakAtom);

  function addWin() {
    setStreak((prev) => {
      const newStreak = prev + 1;
      // Update best streak if current exceeds it
      if (newStreak > bestStreak) {
        setBestStreak(newStreak);
      }
      return newStreak;
    });
  }

  function addLoss() {
    // Reset streak to 0, but keep bestStreak
    setStreak(0);
  }

  function resetStreak() {
    // Reset both to 0
    setStreak(0);
    setBestStreak(0);
  }

  return {
    streak,
    bestStreak,
    addWin,
    addLoss,
    resetStreak,
  };
}
