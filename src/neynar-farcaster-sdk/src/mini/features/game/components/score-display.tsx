"use client";

import { useEffect, useState, useRef } from "react";

export type ScoreDisplayProps = {
  value: number;
  duration?: number;
  className?: string;
};

/**
 * Animated score counter with smooth count-up animation
 *
 * Animates from the previous value to the new value using an ease-out
 * cubic easing function. Pure JavaScript animation with no dependencies.
 *
 * @param value - Current score value to display
 * @param duration - Animation duration in milliseconds (default: 500)
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * const { score } = useScore(0);
 *
 * <ScoreDisplay
 *   value={score}
 *   duration={500}
 *   className="text-4xl font-bold"
 * />
 * ```
 */
export function ScoreDisplay({
  value,
  duration = 500,
  className = "",
}: ScoreDisplayProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const startValueRef = useRef(value);

  useEffect(() => {
    // Cancel any ongoing animation
    if (animationRef.current !== undefined) {
      cancelAnimationFrame(animationRef.current);
    }

    // If value hasn't changed, don't animate
    if (value === displayValue) {
      return;
    }

    setIsAnimating(true);
    startValueRef.current = displayValue;
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);

      // Calculate current value
      const current = Math.round(
        startValueRef.current + (value - startValueRef.current) * eased,
      );

      setDisplayValue(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== undefined) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, displayValue]);

  return (
    <div
      className={`transition-transform ${
        isAnimating ? "scale-110" : "scale-100"
      } ${className}`}
      style={{
        transitionDuration: "150ms",
      }}
    >
      {displayValue.toLocaleString()}
    </div>
  );
}
