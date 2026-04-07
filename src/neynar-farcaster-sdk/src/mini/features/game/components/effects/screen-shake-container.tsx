"use client";

import type { ReactNode } from "react";

export type ScreenShakeContainerProps = {
  children: ReactNode;
  isShaking: boolean;
  offset: { x: number; y: number };
  className?: string;
};

/**
 * Screen shake container component
 *
 * Wraps game content and applies shake transform from useScreenShake hook.
 * Only applies transform when isShaking is true.
 *
 * @param children - Game content to shake
 * @param isShaking - Whether shake is active
 * @param offset - X/Y offset from useScreenShake
 * @param className - Additional CSS classes
 *
 * @example
 * ```typescript
 * const { shake, isShaking, offset } = useScreenShake();
 *
 * return (
 *   <ScreenShakeContainer isShaking={isShaking} offset={offset}>
 *     <YourGame />
 *     <button onClick={() => shake(8, 500)}>Shake!</button>
 *   </ScreenShakeContainer>
 * );
 * ```
 */
export function ScreenShakeContainer({
  children,
  isShaking,
  offset,
  className = "",
}: ScreenShakeContainerProps) {
  return (
    <div
      className={className}
      style={{
        transform: isShaking
          ? `translate(${offset.x}px, ${offset.y}px)`
          : "none",
        transition: "none",
      }}
    >
      {children}
    </div>
  );
}
