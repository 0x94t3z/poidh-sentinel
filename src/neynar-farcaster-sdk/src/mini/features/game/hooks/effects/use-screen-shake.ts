"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Screen shake effect for impact feedback (camera/viewport shake)
 *
 * Generates randomized X/Y offset values that decay over time, creating a camera shake
 * effect for high-impact moments. Uses requestAnimationFrame for smooth 60 FPS animation.
 * Intensity controls shake magnitude (1-10 range, auto-clamped). Duration specifies
 * shake length in milliseconds. Offsets decay linearly to zero.
 *
 * ## Implementation Pattern
 * Apply offset to game container transform. Use ScreenShakeContainer component
 * for pre-built integration with proper styling.
 *
 * ## Performance
 * Uses single requestAnimationFrame loop. Automatically cleans up on unmount.
 * Multiple shake calls override previous shake (doesn't stack).
 *
 * @returns Object with shake trigger function, active state boolean, and current offset
 *
 * @example Basic implementation - Damage feedback
 * ```typescript
 * const { shake, isShaking, offset } = useScreenShake();
 *
 * const handleHit = () => {
 *   shake(8, 500); // Intense shake for 500ms
 *   takeDamage(10);
 * };
 *
 * return (
 *   <div style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}>
 *     <GameBoard />
 *   </div>
 * );
 * ```
 *
 * @example Intensity patterns for different events
 * ```typescript
 * const { shake } = useScreenShake();
 *
 * // Light shake - Small hit
 * shake(3, 200);
 *
 * // Medium shake - Enemy death
 * shake(6, 400);
 *
 * // Heavy shake - Explosion or boss hit
 * shake(10, 800);
 *
 * // Quick shake - Collision
 * shake(4, 150);
 * ```
 *
 * @example Using ScreenShakeContainer component
 * ```typescript
 * import { ScreenShakeContainer } from '@/neynar-farcaster-sdk/mini';
 *
 * const { shake, isShaking, offset } = useScreenShake();
 *
 * return (
 *   <ScreenShakeContainer isShaking={isShaking} offset={offset}>
 *     <GameBoard />
 *   </ScreenShakeContainer>
 * );
 * ```
 *
 * @example Conditional shake based on game state
 * ```typescript
 * const { shake } = useScreenShake();
 * const { health } = useGameState();
 *
 * const handleDamage = (amount: number) => {
 *   // Shake intensity proportional to damage
 *   const intensity = Math.min(10, amount / 2);
 *   const duration = 200 + (amount * 10);
 *   shake(intensity, duration);
 *
 *   // Critical health shake is more intense
 *   if (health < 20) {
 *     setTimeout(() => shake(5, 300), duration + 100);
 *   }
 * };
 * ```
 */
export function useScreenShake() {
  const [isShaking, setIsShaking] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const frameRef = useRef<number | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const intensityRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  });

  const shake = (intensity: number = 5, duration: number = 300) => {
    // Clamp intensity to 1-10
    intensityRef.current = Math.max(1, Math.min(10, intensity));
    durationRef.current = duration;
    startTimeRef.current = performance.now();
    setIsShaking(true);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / durationRef.current, 1);

      if (progress < 1) {
        // Decay intensity over time
        const currentIntensity = intensityRef.current * (1 - progress);

        // Generate random offsets
        const x = (Math.random() - 0.5) * 2 * currentIntensity;
        const y = (Math.random() - 0.5) * 2 * currentIntensity;

        setOffset({ x, y });
        frameRef.current = requestAnimationFrame(animate);
      } else {
        // Reset to zero
        setOffset({ x: 0, y: 0 });
        setIsShaking(false);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  };

  return {
    shake,
    isShaking,
    offset,
  };
}
