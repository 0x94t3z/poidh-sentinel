"use client";

import { Button, Kbd } from "@neynar/ui";
import type { GameAction } from "../hooks/initialization/use-initialize-game";

type ActionButtonWrapperProps = {
  onPress: () => void;
  variant: "default" | "secondary" | "outline" | "ghost";
  buttonSize: string;
  label: React.ReactNode;
  ariaLabel: string;
  keyboardHint?: string[];
  isActive?: boolean;
};

function ActionButtonWrapper({
  onPress,
  variant,
  buttonSize,
  label,
  ariaLabel,
  keyboardHint,
  isActive = false,
}: ActionButtonWrapperProps) {
  // Format key for display
  const formatKey = (key: string): string => {
    if (key === " ") return "Space";
    return key;
  };

  // Get unique display keys (deduplicate case-insensitive keys like 'e' and 'E')
  const uniqueKeys = keyboardHint
    ? Array.from(
        new Set(
          keyboardHint.map((key) =>
            key.length === 1 ? key.toLowerCase() : key,
          ),
        ),
      )
    : [];

  // Prefer shorter keys (single char) over longer ones (Enter, Shift)
  const displayKeys = uniqueKeys
    .sort((a, b) => a.length - b.length)
    .slice(0, 2)
    .map(formatKey);

  const handleInteraction = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    onPress();
  };

  return (
    <div className="relative group">
      <Button
        onTouchStart={handleInteraction}
        onMouseDown={handleInteraction}
        variant={variant}
        className={`${buttonSize} transition-all ${
          isActive
            ? "scale-95 ring-2 ring-primary/50 shadow-inner"
            : "active:scale-95"
        }`}
        aria-label={ariaLabel}
        aria-pressed={isActive}
      >
        {label}
      </Button>
      {displayKeys.length > 0 && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="flex gap-1">
            {displayKeys.map((key, i) => (
              <Kbd key={i} className="text-xs">
                {key}
              </Kbd>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type ActionButtonsProps = {
  /**
   * Handler for primary action button (jump, shoot, etc.)
   */
  onAction?: () => void;

  /**
   * Handler for secondary action button (optional)
   */
  onAction2?: () => void;

  /**
   * Label for primary action button
   * @default "↑"
   */
  actionLabel?: React.ReactNode;

  /**
   * Label for secondary action button
   * @default "A"
   */
  action2Label?: React.ReactNode;

  /**
   * Button variant for primary action
   * @default "secondary"
   */
  actionVariant?: "default" | "secondary" | "outline" | "ghost";

  /**
   * Button variant for secondary action
   * @default "outline"
   */
  action2Variant?: "default" | "secondary" | "outline" | "ghost";

  /**
   * Button size
   * @default "w-12 h-12"
   */
  buttonSize?: string;

  /**
   * Layout orientation
   * @default "horizontal"
   */
  layout?: "horizontal" | "vertical";

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * Optional keyboard shortcuts to display on buttons
   * Get these from useActiveGameActions after calling useInitializeGame
   */
  keyboardHints?: {
    action?: string[];
    action2?: string[];
  };

  /**
   * Set of currently active actions for visual feedback
   * Get this from useActiveGameActions after calling useInitializeGame
   */
  activeKeys?: Set<GameAction>;
};

/**
 * ActionButtons - Pre-built action button group for games
 *
 * Provides 1-2 action buttons (jump, shoot, etc.) with dual input support.
 * Shows keyboard shortcuts on hover when keyboardHints prop is provided.
 * Labels can be text, icons, or any React node.
 *
 * @example Single action button
 * ```tsx
 * // Define action handler
 * const handleJump = () => playerJump();
 *
 * // Register with game initialization
 * useInitializeGame({
 *   actions: {
 *     action: { handler: handleJump }
 *   }
 * });
 *
 * // Get handlers for button
 * const handlers = useGameActionHandlers();
 * const activeKeys = useActiveGameActions();
 *
 * <ActionButtons
 *   onAction={handlers.action}
 *   actionLabel="↑"
 *   activeKeys={activeKeys}
 * />
 * ```
 *
 * @example With icons (using lucide-react)
 * ```tsx
 * import { RotateCw, ArrowDown } from "lucide-react";
 *
 * <ActionButtons
 *   onAction={() => rotate()}
 *   onAction2={() => drop()}
 *   actionLabel={<RotateCw className="w-4 h-4" />}
 *   action2Label={<ArrowDown className="w-4 h-4" />}
 * />
 * ```
 *
 * @example Two action buttons with text
 * ```tsx
 * <ActionButtons
 *   onAction={() => playerJump()}
 *   onAction2={() => playerShoot()}
 *   actionLabel="Jump"
 *   action2Label="Fire"
 * />
 * ```
 */
export function ActionButtons({
  onAction,
  onAction2,
  actionLabel = "↑",
  action2Label = "A",
  actionVariant = "secondary",
  action2Variant = "outline",
  buttonSize = "w-12 h-12",
  layout = "horizontal",
  className = "",
  keyboardHints,
  activeKeys,
}: ActionButtonsProps) {
  const containerClass =
    layout === "horizontal"
      ? `flex items-center gap-2 ${className}`
      : `flex flex-col items-center gap-2 ${className}`;

  return (
    <div className={containerClass}>
      {onAction && (
        <ActionButtonWrapper
          onPress={onAction}
          variant={actionVariant}
          buttonSize={buttonSize}
          label={actionLabel}
          ariaLabel="Primary action"
          keyboardHint={keyboardHints?.action}
          isActive={activeKeys?.has("action") || false}
        />
      )}
      {onAction2 && (
        <ActionButtonWrapper
          onPress={onAction2}
          variant={action2Variant}
          buttonSize={buttonSize}
          label={action2Label}
          ariaLabel="Secondary action"
          keyboardHint={keyboardHints?.action2}
          isActive={activeKeys?.has("action2") || false}
        />
      )}
    </div>
  );
}
