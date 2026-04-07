"use client";

import { atom, useAtom, useAtomValue } from "jotai";
import { gameConfigAtom } from "./use-game-state";

/**
 * Global score atom
 * Shared across all components that use useScore
 */
const scoreAtom = atom<number>(0);

/**
 * Global score management hook using Jotai atoms
 *
 * Manages score state globally with helper functions to manipulate the score.
 * Score is shared across all components that use this hook.
 * Reads allowNegativeScore config from gameConfigAtom (set via useInitializeGame).
 *
 * @returns Object with score value and manipulation functions
 *
 * @example
 * ```typescript
 * // Initialize game config first
 * useInitializeGame({
 *   config: { allowNegativeScore: true },
 *   actions: { ... }
 * });
 *
 * // Then use score hook
 * const { score, addScore, subtractScore, setScore, resetScore } = useScore();
 *
 * // Player collects coin
 * addScore(10);
 *
 * // Player gets bonus
 * addScore(100);
 *
 * // Player takes damage penalty
 * subtractScore(25);
 *
 * // With allowNegativeScore: false (default)
 * subtractScore(1000); // Score becomes 0, not negative
 *
 * // With allowNegativeScore: true
 * subtractScore(1000); // Score can go negative (e.g., -900)
 *
 * // Set score directly
 * setScore(500);
 *
 * // Reset to zero
 * resetScore();
 * ```
 */
export function useScore() {
  const [score, setScore] = useAtom(scoreAtom);
  const gameConfig = useAtomValue(gameConfigAtom);

  function addScore(amount: number) {
    setScore((prev) => prev + amount);
  }

  function subtractScore(amount: number) {
    setScore((prev) => {
      const newScore = prev - amount;
      return gameConfig.allowNegativeScore ? newScore : Math.max(0, newScore);
    });
  }

  function resetScore() {
    setScore(0);
  }

  return {
    score,
    setScore,
    addScore,
    subtractScore,
    resetScore,
  };
}
