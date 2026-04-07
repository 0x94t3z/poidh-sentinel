"use client";

import { useState, useEffect } from "react";

export type CountdownAnimationProps = {
  onComplete: () => void;
  startFrom?: number;
  className?: string;
};

/**
 * Full-screen countdown animation (3... 2... 1... GO!)
 *
 * Displays a full-screen overlay with animated countdown.
 * Auto-removes from DOM when complete.
 *
 * @param onComplete - Callback when animation completes
 * @param startFrom - Starting number (default: 3)
 * @param className - Additional CSS classes
 *
 * @example
 * ```tsx
 * const [showCountdown, setShowCountdown] = useState(true);
 *
 * {showCountdown && (
 *   <CountdownAnimation
 *     onComplete={() => {
 *       setShowCountdown(false);
 *       startGame();
 *     }}
 *   />
 * )}
 * ```
 */
export function CountdownAnimation({
  onComplete,
  startFrom = 3,
  className = "",
}: CountdownAnimationProps) {
  const [count, setCount] = useState(startFrom);
  const [isGo, setIsGo] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Handle countdown
  useEffect(() => {
    if (count > 0) {
      const timeout = setTimeout(() => {
        setCount(count - 1);
      }, 1000);
      return () => clearTimeout(timeout);
    } else if (count === 0 && !isGo) {
      // When countdown reaches 0, show GO!
      setIsGo(true);
    }
  }, [count, isGo]);

  // Handle GO! display and exit
  useEffect(() => {
    if (isGo && !isExiting) {
      const timeout = setTimeout(() => {
        setIsExiting(true);
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [isGo, isExiting]);

  // Handle exit and onComplete
  useEffect(() => {
    if (isExiting) {
      const timeout = setTimeout(() => {
        onComplete();
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isExiting, onComplete]);

  return (
    <>
      <style>{`
        @keyframes countdown-pulse {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-300 ${
          isExiting ? "opacity-0" : "opacity-100"
        } ${className}`}
      >
        <div
          className={`font-bold transition-all duration-300 ${
            isGo ? "text-green-400 text-9xl scale-150" : "text-white text-8xl"
          }`}
          style={{
            animation: isGo ? "none" : "countdown-pulse 0.5s ease-out",
          }}
        >
          {isGo ? "GO!" : count}
        </div>
      </div>
    </>
  );
}
