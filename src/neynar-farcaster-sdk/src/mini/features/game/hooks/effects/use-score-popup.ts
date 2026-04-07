"use client";

import { useState, useRef } from "react";
import { useGameLoop } from "../initialization/use-game-loop";

export type ScorePopup = {
  id: string;
  x: number;
  y: number;
  value: number;
  life: number;
};

/**
 * Floating score popup hook
 *
 * Creates floating "+100" style text that fades up and disappears.
 * Automatically cleans up after animation completes (~1000ms).
 *
 * @returns Object with popups array and show function
 *
 * @example
 * ```typescript
 * const { popups, show } = useScorePopup();
 *
 * // Player collects coin
 * show(coinX, coinY, 100);
 *
 * // Render popups
 * {popups.map(popup => (
 *   <div
 *     key={popup.id}
 *     style={{
 *       position: 'absolute',
 *       left: popup.x,
 *       top: popup.y - (1 - popup.life) * 50,
 *       opacity: popup.life,
 *       fontSize: '24px',
 *       fontWeight: 'bold',
 *       color: popup.value > 0 ? '#00FF00' : '#FF0000',
 *     }}
 *   >
 *     {popup.value > 0 ? '+' : ''}{popup.value}
 *   </div>
 * ))}
 * ```
 */
export function useScorePopup() {
  const [popups, setPopups] = useState<ScorePopup[]>([]);
  const nextIdRef = useRef(0);

  useGameLoop((deltaTime) => {
    if (popups.length === 0) return;

    setPopups((prev) => {
      return prev
        .map((popup) => {
          // Decrease life faster than particles
          const life = popup.life - 0.025 * (deltaTime / 16);

          return {
            ...popup,
            life,
          };
        })
        .filter((p) => p.life > 0);
    });
  }, 60);

  const show = (x: number, y: number, value: number) => {
    const newPopup: ScorePopup = {
      id: `popup-${nextIdRef.current++}`,
      x,
      y,
      value,
      life: 1.0,
    };

    setPopups((prev) => [...prev, newPopup]);
  };

  return {
    popups,
    show,
  };
}
