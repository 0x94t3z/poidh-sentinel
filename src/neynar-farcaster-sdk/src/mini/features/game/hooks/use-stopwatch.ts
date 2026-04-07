"use client";

import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomEffect } from "jotai-effect";
import { isGamePausedAtom } from "../private/atoms";

/**
 * Global stopwatch atoms
 * Shared across all components that use useStopwatch
 */
const elapsedAtom = atom<number>(0);
const isRunningAtom = atom<boolean>(false);
const startTimeAtom = atom<number>(0);
const pausedElapsedAtom = atom<number>(0);

/**
 * Singleton stopwatch effect
 * Runs a single animation loop for all components using useStopwatch
 * Automatically pauses when the game is paused
 */
const stopwatchEffectAtom = atomEffect((get, set) => {
  const isRunning = get(isRunningAtom);
  const isGamePaused = get(isGamePausedAtom);

  // Don't run if not started or game is paused
  if (!isRunning || isGamePaused) {
    return;
  }

  const startTime = get(startTimeAtom);
  const pausedElapsed = get(pausedElapsedAtom);
  let frameId: number | undefined;

  const loop = () => {
    // Check pause state each frame
    if (get.peek(isGamePausedAtom)) {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }
      return;
    }

    const currentElapsed = pausedElapsed + (Date.now() - startTime);
    set(elapsedAtom, currentElapsed);
    frameId = requestAnimationFrame(loop);
  };

  frameId = requestAnimationFrame(loop);

  return () => {
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId);
    }
  };
});

/**
 * Stopwatch timer that counts up from 0 (global)
 *
 * Automatically pauses when the game is paused via `useGamePaused()`.
 * Must call start() to begin counting (doesn't auto-start).
 * Uses Jotai atoms for global state.
 *
 * @returns Object with timer state and control functions
 *
 * @example
 * ```typescript
 * const { elapsed, isRunning, start, pause, resume, reset } = useStopwatch();
 *
 * // Start stopwatch on button click
 * start();
 *
 * // Display seconds: (elapsed / 1000).toFixed(2) + 's'
 * // Display MM:SS: Use Timer component
 *
 * // Pause/resume
 * pause();
 * resume();
 *
 * // Reset to 0
 * reset();
 * ```
 */
export function useStopwatch() {
  const [elapsed, setElapsed] = useAtom(elapsedAtom);
  const [isRunning, setIsRunning] = useAtom(isRunningAtom);
  const setStartTime = useSetAtom(startTimeAtom);
  const setPausedElapsed = useSetAtom(pausedElapsedAtom);

  // Mount the effect atom to activate the singleton timer
  useAtomValue(stopwatchEffectAtom);

  function start() {
    setIsRunning(true);
    setElapsed(0);
    setPausedElapsed(0);
    setStartTime(Date.now());
  }

  function pause() {
    setIsRunning(false);
    setPausedElapsed(elapsed);
  }

  function resume() {
    setIsRunning(true);
    setStartTime(Date.now());
  }

  function reset() {
    setIsRunning(false);
    setElapsed(0);
    setPausedElapsed(0);
  }

  return {
    elapsed,
    isRunning,
    start,
    pause,
    resume,
    reset,
  };
}
