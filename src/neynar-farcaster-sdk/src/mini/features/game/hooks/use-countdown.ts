"use client";

import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { atomEffect } from "jotai-effect";
import { useEffect } from "react";
import { isGamePausedAtom } from "../private/atoms";

type UseCountdownOptions = {
  onComplete?: () => void;
};

/**
 * Global countdown atoms
 * Shared across all components that use useCountdown
 */
const timeLeftAtom = atom<number>(0);
const isRunningAtom = atom<boolean>(false);
const startTimeAtom = atom<number>(0);
const pausedTimeAtom = atom<number>(0);
const onCompleteCallbackAtom = atom<(() => void) | undefined>(undefined);

/**
 * Singleton countdown effect
 * Runs a single animation loop for all components using useCountdown
 * Automatically pauses when the game is paused
 */
const countdownEffectAtom = atomEffect((get, set) => {
  const isRunning = get(isRunningAtom);
  const isGamePaused = get(isGamePausedAtom);

  // Don't run if not started or game is paused
  if (!isRunning || isGamePaused) {
    return;
  }

  const startTime = get(startTimeAtom);
  const pausedTime = get(pausedTimeAtom);
  let frameId: number | undefined;

  const loop = () => {
    // Check pause state each frame
    if (get.peek(isGamePausedAtom)) {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }
      return;
    }

    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, pausedTime - elapsed);

    set(timeLeftAtom, remaining);

    if (remaining <= 0) {
      set(isRunningAtom, false);
      const onComplete = get.peek(onCompleteCallbackAtom);
      if (onComplete) {
        onComplete();
      }
      return;
    }

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
 * Countdown timer that counts down from a specified duration (global)
 *
 * Automatically pauses when the game is paused via `useGamePaused()`.
 * Calls onComplete callback when timer reaches 0.
 * Must call start() to begin countdown (doesn't auto-start).
 * Uses Jotai atoms for global state.
 *
 * @param seconds - Total duration in seconds
 * @param options - Configuration options
 * @param options.onComplete - Callback when countdown reaches 0
 * @returns Object with timer state and control functions
 *
 * @example
 * ```typescript
 * const { timeLeft, isRunning, start, pause, resume, reset } = useCountdown(60, {
 *   onComplete: () => alert('Time up!')
 * });
 *
 * // Start countdown
 * start();
 *
 * // Display seconds: Math.ceil(timeLeft / 1000)
 * // Display MM:SS: Use Timer component
 *
 * // Pause/resume
 * pause();
 * resume();
 *
 * // Reset to initial time
 * reset();
 * ```
 */
export function useCountdown(seconds: number, options?: UseCountdownOptions) {
  const totalTime = seconds * 1000; // Convert to milliseconds
  const [timeLeft, setTimeLeft] = useAtom(timeLeftAtom);
  const [isRunning, setIsRunning] = useAtom(isRunningAtom);
  const setStartTime = useSetAtom(startTimeAtom);
  const setPausedTime = useSetAtom(pausedTimeAtom);
  const setOnCompleteCallback = useSetAtom(onCompleteCallbackAtom);

  // Mount the effect atom to activate the singleton timer
  useAtomValue(countdownEffectAtom);

  // Set the onComplete callback when it changes (in useEffect to avoid re-renders)
  useEffect(() => {
    if (options?.onComplete !== undefined) {
      setOnCompleteCallback(options.onComplete);
    }
  }, [options?.onComplete, setOnCompleteCallback]);

  function start() {
    setIsRunning(true);
    setPausedTime(totalTime);
    setTimeLeft(totalTime);
    setStartTime(Date.now());
  }

  function pause() {
    setIsRunning(false);
    setPausedTime(timeLeft);
  }

  function resume() {
    setIsRunning(true);
    setStartTime(Date.now());
  }

  function reset() {
    setIsRunning(false);
    setTimeLeft(totalTime);
    setPausedTime(totalTime);
  }

  return {
    timeLeft,
    isRunning,
    start,
    pause,
    resume,
    reset,
  };
}
