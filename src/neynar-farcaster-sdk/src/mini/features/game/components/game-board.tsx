"use client";

import { ReactNode } from "react";
import { Stack } from "@neynar/ui";

type GameBoardProps = {
  /**
   * The game canvas/content area
   */
  children: ReactNode;
  /**
   * Game controls (buttons, d-pad, etc.)
   */
  controls: ReactNode;
};

/**
 * GameBoard - Container for game content and controls
 *
 * Creates a two-section layout within a tab:
 * - Game area (fills available space)
 * - Controls section (fixed at bottom)
 *
 * Usage:
 * ```tsx
 * <GameBoard controls={<YourControls />}>
 *   <YourGameCanvas />
 * </GameBoard>
 * ```
 */
export function GameBoard({ children, controls }: GameBoardProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Game content area - fills available space */}
      <div className="flex-1 overflow-y-auto">{children}</div>
      {/* Controls section - fixed at bottom */}
      {controls && <Stack className="bg-card border-t p-1">{controls}</Stack>}
    </div>
  );
}
