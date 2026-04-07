"use client";

import { atom, useAtomValue, useSetAtom } from "jotai";
import {
  activeGameActionsAtom,
  gameControlsEnabledAtom,
  isGamePausedAtom,
  isGameOverAtom,
  isGameLoadingAtom,
  gameActionHandlersAtom,
} from "../private/atoms";
import type { GameConfig } from "../private/types";

/**
 * Global game configuration atom
 * Shared state that game hooks (like useScore) need to read
 */
export const gameConfigAtom = atom<GameConfig>({
  allowNegativeScore: false,
});

/**
 * Get the currently active game actions
 *
 * Returns a Set of GameAction keys that are currently pressed.
 * Useful for visual feedback like highlighting active buttons.
 *
 * @returns Set of active GameAction keys
 *
 * @example
 * ```tsx
 * const activeKeys = useActiveGameActions();
 * const isJumpActive = activeKeys.has('jump');
 * ```
 */
export function useActiveGameActions() {
  return useAtomValue(activeGameActionsAtom);
}

/**
 * Set the active game actions
 *
 * Updates which keys/buttons are currently pressed.
 * Typically used internally by useInitializeGame.
 *
 * @returns Setter function that accepts a Set or updater function
 *
 * @example
 * ```tsx
 * const setActiveKeys = useSetActiveGameActions();
 * setActiveKeys(prev => new Set(prev).add('jump'));
 * ```
 */
export function useSetActiveGameActions() {
  return useSetAtom(activeGameActionsAtom);
}

/**
 * Check if game controls are enabled
 *
 * Returns whether keyboard and touch controls are currently active.
 * When false, useInitializeGame will not respond to input.
 *
 * @returns True if controls are enabled
 *
 * @example
 * ```tsx
 * const isEnabled = useGameControlsEnabled();
 * if (!isEnabled) {
 *   return <div>Controls disabled</div>;
 * }
 * ```
 */
export function useGameControlsEnabled() {
  return useAtomValue(gameControlsEnabledAtom);
}

/**
 * Enable or disable game controls
 *
 * Use this to disable controls during animations, cutscenes, or loading.
 * Automatically integrates with useInitializeGame.
 *
 * @returns Setter function that accepts a boolean
 *
 * @example
 * ```tsx
 * const setControlsEnabled = useSetGameControlsEnabled();
 *
 * // Disable during animation
 * useEffect(() => {
 *   if (isAnimating) {
 *     setControlsEnabled(false);
 *   } else {
 *     setControlsEnabled(true);
 *   }
 * }, [isAnimating, setControlsEnabled]);
 * ```
 */
export function useSetGameControlsEnabled() {
  return useSetAtom(gameControlsEnabledAtom);
}

/**
 * Check if game is paused
 *
 * Returns the current pause state of the game.
 *
 * @returns True if game is paused
 *
 * @example
 * ```tsx
 * const isPaused = useGamePaused();
 * return <div>{isPaused ? 'PAUSED' : 'PLAYING'}</div>;
 * ```
 */
export function useGamePaused() {
  return useAtomValue(isGamePausedAtom);
}

/**
 * Set game pause state
 *
 * Pause or resume the game. This is just state management - you need to
 * implement the actual pause logic (stopping game loop, etc).
 *
 * @returns Setter function that accepts a boolean
 *
 * @example
 * ```tsx
 * const setIsPaused = useSetGamePaused();
 *
 * function togglePause() {
 *   setIsPaused(prev => !prev);
 * }
 * ```
 */
export function useSetGamePaused() {
  return useSetAtom(isGamePausedAtom);
}

/**
 * Check if game is over
 *
 * Returns whether the game has ended (win or lose).
 *
 * @returns True if game is over
 *
 * @example
 * ```tsx
 * const isGameOver = useGameOver();
 * if (isGameOver) {
 *   return <GameOverScreen />;
 * }
 * ```
 */
export function useGameOver() {
  return useAtomValue(isGameOverAtom);
}

/**
 * Set game over state
 *
 * Mark the game as finished. Useful for triggering game over UI,
 * disabling controls, showing scores, etc.
 *
 * @returns Setter function that accepts a boolean
 *
 * @example
 * ```tsx
 * const setIsGameOver = useSetGameOver();
 *
 * function handlePlayerDeath() {
 *   setIsGameOver(true);
 *   showDeathAnimation();
 * }
 * ```
 */
export function useSetGameOver() {
  return useSetAtom(isGameOverAtom);
}

/**
 * Check if game is loading
 *
 * Returns whether the game is in a loading state.
 *
 * @returns True if game is loading
 *
 * @example
 * ```tsx
 * const isLoading = useGameLoading();
 * if (isLoading) {
 *   return <LoadingSpinner />;
 * }
 * ```
 */
export function useGameLoading() {
  return useAtomValue(isGameLoadingAtom);
}

/**
 * Set game loading state
 *
 * Indicate loading status for assets, level data, etc.
 *
 * @returns Setter function that accepts a boolean
 *
 * @example
 * ```tsx
 * const setIsLoading = useSetGameLoading();
 *
 * async function loadLevel() {
 *   setIsLoading(true);
 *   await fetchLevelData();
 *   setIsLoading(false);
 * }
 * ```
 */
export function useSetGameLoading() {
  return useSetAtom(isGameLoadingAtom);
}

/**
 * Get game action handlers
 *
 * Returns the globally stored handlers created by useInitializeGame.
 * Use this in child components to access button/key handlers.
 *
 * @returns Object mapping GameAction to handler functions
 *
 * @example
 * ```tsx
 * const handlers = useGameActionHandlers();
 * return (
 *   <button onTouchStart={handlers.jump}>
 *     Jump
 *   </button>
 * );
 * ```
 */
export function useGameActionHandlers() {
  return useAtomValue(gameActionHandlersAtom);
}

/**
 * Set game action handlers
 *
 * Store handlers globally. This is used internally by useInitializeGame.
 * You should NOT need to call this directly in your game code.
 *
 * @returns Setter function for handlers object
 *
 * @internal This is for internal use by useInitializeGame
 */
export function useSetGameActionHandlers() {
  return useSetAtom(gameActionHandlersAtom);
}
