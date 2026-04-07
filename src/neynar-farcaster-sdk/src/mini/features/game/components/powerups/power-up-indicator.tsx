"use client";

import type { ActivePowerUp } from "../../hooks/powerups/use-power-ups";

export type PowerUpIndicatorProps = {
  powerUps: ActivePowerUp[];
  position?: "top" | "bottom";
  className?: string;
};

/**
 * Power-up indicator component
 *
 * Displays active power-ups with circular progress ring showing time remaining.
 * Stacks horizontally.
 *
 * @example
 * ```typescript
 * const powerUps = usePowerUps(definitions);
 *
 * <PowerUpIndicator powerUps={powerUps.activePowerUps} position="top" />
 * ```
 */
export function PowerUpIndicator({
  powerUps,
  position = "top",
  className = "",
}: PowerUpIndicatorProps) {
  if (powerUps.length === 0) return null;

  const positionClasses = position === "top" ? "top-4" : "bottom-4";

  return (
    <div className={`fixed left-4 ${positionClasses} flex gap-2 ${className}`}>
      {powerUps.map((powerUp) => {
        const progress = powerUp.timeRemaining / powerUp.duration;
        const circumference = 2 * Math.PI * 20;
        const strokeDashoffset = circumference * (1 - progress);

        return (
          <div
            key={powerUp.id}
            className="relative flex flex-col items-center bg-white rounded-lg p-2 shadow-lg"
          >
            {/* Progress ring */}
            <svg width="48" height="48" className="transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#E5E7EB"
                strokeWidth="4"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.1s linear" }}
              />
            </svg>

            {/* Icon or name */}
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {powerUp.icon || powerUp.name.slice(0, 2).toUpperCase()}
            </div>

            {/* Time remaining */}
            <div className="text-xs text-gray-600 mt-1">
              {Math.ceil(powerUp.timeRemaining / 1000)}s
            </div>
          </div>
        );
      })}
    </div>
  );
}
