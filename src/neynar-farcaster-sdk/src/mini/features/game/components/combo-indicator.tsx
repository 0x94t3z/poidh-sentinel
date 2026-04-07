"use client";

import { useEffect, useState, useRef } from "react";

export type ComboIndicatorProps = {
  combo: number;
  multiplier: number;
  show?: boolean;
  className?: string;
};

/**
 * Shows combo multiplier with pulse animation
 *
 * Displays "2x COMBO!", "3x COMBO!", etc. with a pulse effect when the
 * combo increases. Automatically hides when combo is 0.
 *
 * @param combo - Current combo count
 * @param multiplier - Current multiplier value
 * @param show - Force show/hide (overrides auto-show behavior)
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * const { combo, multiplier } = useCombo(1000);
 *
 * <ComboIndicator combo={combo} multiplier={multiplier} />
 * ```
 */
export function ComboIndicator({
  combo,
  multiplier,
  show,
  className = "",
}: ComboIndicatorProps) {
  const [isPulsing, setIsPulsing] = useState(false);
  const prevMultiplierRef = useRef(multiplier);

  // Detect when multiplier increases
  useEffect(() => {
    if (multiplier > prevMultiplierRef.current) {
      setIsPulsing(true);
      const timeout = setTimeout(() => setIsPulsing(false), 300);
      return () => clearTimeout(timeout);
    }
    prevMultiplierRef.current = multiplier;
  }, [multiplier]);

  // Determine if should show
  const shouldShow = show !== undefined ? show : combo > 0;

  if (!shouldShow) {
    return null;
  }

  // Color intensity increases with multiplier
  const colorClass =
    multiplier >= 5
      ? "text-purple-400"
      : multiplier >= 3
        ? "text-yellow-400"
        : "text-blue-400";

  return (
    <div
      className={`font-bold text-center transition-all duration-300 ${
        isPulsing ? "scale-125" : "scale-100"
      } ${colorClass} ${className}`}
      style={{
        textShadow: "0 0 10px currentColor",
        opacity: shouldShow ? 1 : 0,
      }}
    >
      {multiplier}x COMBO!
    </div>
  );
}
