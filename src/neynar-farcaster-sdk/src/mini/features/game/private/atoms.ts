"use client";

/**
 * Internal game state atoms
 *
 * These atoms are used internally by game hooks and should not be
 * exported from the public API. They manage global game state like
 * pause, controls enabled, active actions, etc.
 *
 * @internal
 */

import { atom } from "jotai";
import type { GameAction } from "./types";

/**
 * Set of currently active game actions (for visual feedback)
 * Used by game controls to track which keys/buttons are pressed
 * @internal
 */
export const activeGameActionsAtom = atom<Set<GameAction>>(
  new Set<GameAction>(),
);

/**
 * Whether game controls are currently enabled
 * Useful for disabling during pause menus or game over
 * @internal
 */
export const gameControlsEnabledAtom = atom<boolean>(true);

/**
 * Whether the game is currently paused
 * @internal
 */
export const isGamePausedAtom = atom<boolean>(false);

/**
 * Whether the game is in a game over state
 * @internal
 */
export const isGameOverAtom = atom<boolean>(false);

/**
 * Whether the game is currently loading
 * @internal
 */
export const isGameLoadingAtom = atom<boolean>(false);

/**
 * Game action handlers stored globally
 * Maps action name to handler function
 * @internal
 */
export const gameActionHandlersAtom = atom<
  Partial<Record<GameAction, () => void>>
>({});
