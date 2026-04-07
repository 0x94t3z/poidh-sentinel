"use client";

import { useEffect, useRef } from "react";
import { useGamePaused } from "../use-game-state";

/**
 * Provides a 60 FPS game loop for frame-based games
 *
 * Calls the callback function at a specified frame rate (default 60 FPS).
 * Automatically pauses when the game is paused via `useGamePaused()`.
 * Uses requestAnimationFrame for smooth, browser-optimized timing.
 *
 * @param callback - Function called each frame with deltaTime in milliseconds
 * @param fps - Target frames per second (default: 60)
 *
 * @example
 * ```typescript
 * // Snake game with 60 FPS game loop
 * useGameLoop((deltaTime) => {
 *   // Move snake based on deltaTime
 *   moveSnake(speed * deltaTime);
 *   checkCollisions();
 *   updateScore();
 * }, 60);
 *
 * // Slower update rate for turn-based game
 * useGameLoop((deltaTime) => {
 *   updateAnimations(deltaTime);
 * }, 30);
 * ```
 */
export function useGameLoop(
  callback: (deltaTime: number) => void,
  fps: number = 60,
): void {
  const isPaused = useGamePaused();
  const requestIdRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const callbackRef = useRef(callback);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (isPaused) {
      // Cancel animation loop when paused
      if (requestIdRef.current !== undefined) {
        cancelAnimationFrame(requestIdRef.current);
        requestIdRef.current = undefined;
      }
      // Reset lastTimeRef so we don't accumulate paused time
      lastTimeRef.current = 0;
      return;
    }

    const targetFrameTime = 1000 / fps;
    let accumulatedTime = 0;

    const loop = (currentTime: number) => {
      // Calculate deltaTime since last frame
      const deltaTime =
        lastTimeRef.current === 0 ? 0 : currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;

      // Accumulate time for frame rate limiting
      accumulatedTime += deltaTime;

      // Call callback at target FPS
      while (accumulatedTime >= targetFrameTime) {
        callbackRef.current(targetFrameTime);
        accumulatedTime -= targetFrameTime;
      }

      // Continue loop
      requestIdRef.current = requestAnimationFrame(loop);
    };

    // Start loop
    requestIdRef.current = requestAnimationFrame(loop);

    // Cleanup
    return () => {
      if (requestIdRef.current !== undefined) {
        cancelAnimationFrame(requestIdRef.current);
      }
    };
  }, [isPaused, fps]);
}
