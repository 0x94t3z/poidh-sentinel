"use client";

import type { Buff } from "../../hooks/powerups/use-buffs";

export type BuffIconProps = {
  buffs: Buff[];
  maxDisplay?: number;
  className?: string;
};

/**
 * Buff icon component
 *
 * Displays buff/debuff icons with progress ring showing time remaining.
 * Color-coded: green for positive buffs, red for negative debuffs.
 *
 * @example
 * ```typescript
 * const buffs = useBuffs();
 *
 * <BuffIcon buffs={buffs.activeBuffs} maxDisplay={5} />
 * ```
 */
export function BuffIcon({
  buffs,
  maxDisplay = 5,
  className = "",
}: BuffIconProps) {
  const displayBuffs = buffs.slice(0, maxDisplay);

  if (displayBuffs.length === 0) return null;

  return (
    <div className={`flex gap-1 ${className}`}>
      {displayBuffs.map((buff) => {
        const progress =
          buff.timeRemaining && buff.duration
            ? buff.timeRemaining / buff.duration
            : 0;
        const circumference = 2 * Math.PI * 16;
        const strokeDashoffset = circumference * (1 - progress);
        const color = buff.type === "positive" ? "#22C55E" : "#EF4444";

        return (
          <div
            key={buff.id}
            className="relative flex items-center justify-center"
            title={`${buff.stat} ${buff.modifier}x`}
          >
            {/* Progress ring */}
            <svg width="36" height="36" className="transform -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="#E5E7EB"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke={color}
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.1s linear" }}
              />
            </svg>

            {/* Icon */}
            <div className="absolute text-xs font-bold" style={{ color }}>
              {buff.icon || buff.stat.slice(0, 1).toUpperCase()}
            </div>
          </div>
        );
      })}
      {buffs.length > maxDisplay && (
        <div className="text-sm text-gray-500">
          +{buffs.length - maxDisplay}
        </div>
      )}
    </div>
  );
}
