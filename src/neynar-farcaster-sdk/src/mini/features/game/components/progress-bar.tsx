"use client";

export type ProgressBarProps = {
  value: number;
  max: number;
  variant?: "default" | "striped" | "animated";
  color?: "primary" | "success" | "danger" | "warning";
  showLabel?: boolean;
  className?: string;
};

/**
 * Linear progress bar with optional percentage label
 *
 * Displays progress as a percentage of max value with smooth transitions.
 * Supports striped and animated variants.
 *
 * @param value - Current value
 * @param max - Maximum value
 * @param variant - Visual style (default, striped, or animated)
 * @param color - Color theme (primary, success, danger, or warning)
 * @param showLabel - Whether to show percentage label (default: true)
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * // Health bar
 * <ProgressBar value={health} max={100} color="success" />
 *
 * // Loading bar
 * <ProgressBar
 *   value={loaded}
 *   max={total}
 *   variant="animated"
 *   color="primary"
 * />
 *
 * // Time remaining
 * <ProgressBar
 *   value={timeLeft}
 *   max={60000}
 *   color="warning"
 *   showLabel={false}
 * />
 * ```
 */
export function ProgressBar({
  value,
  max,
  variant = "default",
  color = "primary",
  showLabel = true,
  className = "",
}: ProgressBarProps) {
  // Calculate percentage (clamped 0-100)
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  // Color classes
  const colorClasses = {
    primary: "bg-blue-500",
    success: "bg-green-500",
    danger: "bg-red-500",
    warning: "bg-yellow-500",
  };

  // Build inline styles for progress bar
  const progressStyle: React.CSSProperties = {
    width: `${percentage}%`,
  };

  // Add striped background if needed
  if (variant === "striped" || variant === "animated") {
    progressStyle.backgroundImage =
      "linear-gradient(45deg, rgba(255, 255, 255, 0.15) 25%, transparent 25%, transparent 50%, rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.15) 75%, transparent 75%, transparent)";
    progressStyle.backgroundSize = "1rem 1rem";
  }

  // Add animation if needed
  if (variant === "animated") {
    progressStyle.animation = "progress-stripes 1s linear infinite";
  }

  return (
    <div className={`relative w-full ${className}`}>
      {/* Background container */}
      <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className={`h-full transition-all duration-300 ${colorClasses[color]}`}
          style={progressStyle}
        />
      </div>

      {/* Percentage label */}
      {showLabel && !isNaN(percentage) && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
          {Math.round(percentage)}%
        </div>
      )}

      {/* Global styles for animation */}
      <style>{`
        @keyframes progress-stripes {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 1rem 0;
          }
        }
      `}</style>
    </div>
  );
}
