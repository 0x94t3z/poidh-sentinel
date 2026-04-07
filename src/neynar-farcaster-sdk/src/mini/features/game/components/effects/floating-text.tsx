"use client";

import type { ScorePopup } from "../../hooks/effects/use-score-popup";

export type FloatingTextProps = {
  popups: ScorePopup[];
  className?: string;
};

/**
 * Floating text component
 *
 * Renders floating score popups from useScorePopup hook.
 * Shows "+100" or "-50" style text that floats up and fades out.
 *
 * @param popups - Array of score popups to render
 * @param className - Additional CSS classes
 *
 * @example
 * ```typescript
 * const { popups, show } = useScorePopup();
 *
 * return (
 *   <div className="relative">
 *     <FloatingText popups={popups} />
 *     <button onClick={() => show(200, 200, 100)}>
 *       +100
 *     </button>
 *   </div>
 * );
 * ```
 */
export function FloatingText({ popups, className = "" }: FloatingTextProps) {
  return (
    <>
      {popups.map((popup) => {
        const floatDistance = (1 - popup.life) * 50;
        const isPositive = popup.value > 0;

        return (
          <div
            key={popup.id}
            className={`absolute pointer-events-none font-bold ${className}`}
            style={{
              left: popup.x,
              top: popup.y - floatDistance,
              opacity: popup.life,
              fontSize: "24px",
              color: isPositive ? "#22C55E" : "#EF4444",
              transform: "translate(-50%, -50%)",
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
              transition: "none",
            }}
          >
            {isPositive ? "+" : ""}
            {popup.value}
          </div>
        );
      })}
    </>
  );
}
