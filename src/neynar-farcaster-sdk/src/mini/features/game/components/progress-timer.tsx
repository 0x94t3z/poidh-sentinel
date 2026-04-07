"use client";

import { Timer } from "./timer";
import { ProgressBar } from "./progress-bar";

export type ProgressTimerProps = {
  current: number;
  total: number;
  variant?: "circular" | "linear";
  size?: number;
  format?: "MM:SS" | "MM:SS.mmm" | "seconds";
  className?: string;
};

/**
 * Circular or linear progress indicator with time display
 *
 * Combines visual progress with formatted time display.
 * Use with useCountdown or useStopwatch hooks.
 *
 * @param current - Current time in milliseconds
 * @param total - Total time in milliseconds
 * @param variant - Display style (circular or linear)
 * @param size - Diameter in pixels for circular variant (default: 120)
 * @param format - Time format (default: 'MM:SS')
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * const { timeLeft } = useCountdown(60);
 *
 * // Circular progress
 * <ProgressTimer
 *   current={timeLeft}
 *   total={60000}
 *   variant="circular"
 *   size={120}
 * />
 *
 * // Linear progress
 * <ProgressTimer
 *   current={timeLeft}
 *   total={60000}
 *   variant="linear"
 * />
 * ```
 */
export function ProgressTimer({
  current,
  total,
  variant = "circular",
  size = 120,
  format = "MM:SS",
  className = "",
}: ProgressTimerProps) {
  const percentage = Math.max(0, Math.min(100, (current / total) * 100));

  if (variant === "linear") {
    return (
      <div className={`space-y-2 ${className}`}>
        <Timer
          milliseconds={current}
          format={format}
          className="text-center font-bold"
        />
        <ProgressBar value={current} max={total} showLabel={false} />
      </div>
    );
  }

  // Circular variant
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      className={`relative inline-block ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-blue-500 transition-all duration-300"
          strokeLinecap="round"
        />
      </svg>
      {/* Time display in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Timer
          milliseconds={current}
          format={format}
          className="font-bold text-lg"
        />
      </div>
    </div>
  );
}
