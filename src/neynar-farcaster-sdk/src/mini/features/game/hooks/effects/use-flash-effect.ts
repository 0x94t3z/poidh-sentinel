"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Full-screen flash effect hook
 *
 * Creates full-screen color flash for damage, power-ups, or transitions.
 * Fades in quickly, then fades out slowly.
 *
 * @returns Object with flash function, flashing state, opacity, and color
 *
 * @example
 * ```typescript
 * const { flash, flashOpacity, flashColor } = useFlashEffect();
 *
 * // Player takes damage
 * flash('rgba(255, 0, 0, 0.5)', 300); // Red flash
 *
 * // Render overlay
 * {flashOpacity > 0 && (
 *   <div
 *     className="fixed inset-0 pointer-events-none"
 *     style={{ backgroundColor: flashColor, opacity: flashOpacity }}
 *   />
 * )}
 * ```
 */
export function useFlashEffect() {
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [flashColor, setFlashColor] = useState("white");
  const frameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  });

  const flash = (color: string = "white", duration: number = 200) => {
    setFlashColor(color);
    durationRef.current = duration;
    startTimeRef.current = performance.now();
    setIsFlashing(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / durationRef.current, 1);

      if (progress < 1) {
        // Ease out: fast in, slow out
        let opacity;
        if (progress < 0.3) {
          // Quick fade in to peak
          opacity = (progress / 0.3) * 0.8;
        } else {
          // Slow fade out
          opacity = 0.8 * (1 - (progress - 0.3) / 0.7);
        }

        setFlashOpacity(opacity);
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setFlashOpacity(0);
        setIsFlashing(false);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  };

  return {
    flash,
    isFlashing,
    flashOpacity,
    flashColor,
  };
}
