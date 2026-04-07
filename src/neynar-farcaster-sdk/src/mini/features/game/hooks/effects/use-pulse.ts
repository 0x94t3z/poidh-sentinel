"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Pulse/scale animation utility for UI elements
 *
 * Pulses element when trigger value changes.
 * Animates scale from 1.0 → 1.2 → 1.0 over ~300ms.
 *
 * @param trigger - Value to watch for changes (e.g., score)
 * @returns Object with current scale value
 *
 * @example
 * ```typescript
 * const { scale } = usePulse(score); // Pulse when score changes
 *
 * <div style={{ transform: `scale(${scale})` }}>
 *   Score: {score}
 * </div>
 * ```
 */
export function usePulse(trigger: unknown) {
  const [scale, setScale] = useState(1.0);
  const frameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const previousTriggerRef = useRef(trigger);

  useEffect(() => {
    // Only pulse if trigger actually changed
    if (trigger !== previousTriggerRef.current) {
      previousTriggerRef.current = trigger;
      startTimeRef.current = performance.now();

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTimeRef.current;
        const duration = 300;
        const progress = Math.min(elapsed / duration, 1);

        if (progress < 1) {
          // Pulse: 1.0 → 1.2 → 1.0
          const pulseProgress =
            progress < 0.5 ? progress * 2 : (1 - progress) * 2;
          const currentScale = 1.0 + pulseProgress * 0.2;

          setScale(currentScale);
          frameRef.current = requestAnimationFrame(animate);
        } else {
          setScale(1.0);
        }
      };

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = requestAnimationFrame(animate);
    }
  }, [trigger]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  });

  return {
    scale,
  };
}
