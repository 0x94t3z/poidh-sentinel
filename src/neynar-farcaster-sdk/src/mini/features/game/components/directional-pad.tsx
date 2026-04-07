"use client";

import { Button, Kbd } from "@neynar/ui";

type DirectionButtonProps = {
  onPress: () => void;
  buttonSize: string;
  label: string;
  ariaLabel: string;
  keyboardHint?: string[];
};

function DirectionButton({
  onPress,
  buttonSize,
  label,
  ariaLabel,
  keyboardHint,
}: DirectionButtonProps) {
  // Format keys for display: prefer short keys (WASD) and arrow symbols
  const formatKey = (key: string): string => {
    if (key === " ") return "Space";
    if (key.startsWith("Arrow")) {
      const dir = key.replace("Arrow", "");
      // Convert to arrow symbols
      if (dir === "Left") return "←";
      if (dir === "Right") return "→";
      if (dir === "Up") return "↑";
      if (dir === "Down") return "↓";
      return dir;
    }
    return key.toUpperCase();
  };

  // Get unique display keys (deduplicate case-insensitive keys like 'a' and 'A')
  const uniqueKeys = keyboardHint
    ? Array.from(
        new Set(
          keyboardHint.map((key) =>
            key.startsWith("Arrow") ? key : key.toLowerCase(),
          ),
        ),
      )
    : [];

  // Prefer single char keys first, then arrow keys
  const displayKeys = uniqueKeys
    .sort((a, b) => {
      const aIsShort = a.length <= 1;
      const bIsShort = b.length <= 1;
      if (aIsShort && !bIsShort) return -1;
      if (!aIsShort && bIsShort) return 1;
      return 0;
    })
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
        className={`${buttonSize} active:scale-95 transition-transform`}
        aria-label={ariaLabel}
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

export type DirectionalPadProps = {
  /**
   * Handler for left button press
   */
  onLeft?: () => void;

  /**
   * Handler for right button press
   */
  onRight?: () => void;

  /**
   * Handler for up button press
   */
  onUp?: () => void;

  /**
   * Handler for down button press
   */
  onDown?: () => void;

  /**
   * Layout style for the D-pad
   * - "horizontal": Left and right arrows only (side-scrollers, racing)
   * - "vertical": Up and down arrows only (elevator games, vertical scrollers)
   * - "full": All four directions (top-down games, menus)
   * @default "horizontal"
   */
  layout?: "horizontal" | "vertical" | "full";

  /**
   * Button size classes
   * @default "w-12 h-12"
   */
  buttonSize?: string;

  /**
   * Additional CSS classes for the container
   */
  className?: string;

  /**
   * Optional keyboard shortcuts to display on buttons
   * (Currently not displayed - reserved for future use)
   */
  keyboardHints?: {
    left?: string[];
    right?: string[];
    up?: string[];
    down?: string[];
  };
};

/**
 * DirectionalPad - Pre-built directional control component
 *
 * Provides arrow buttons for directional movement in games.
 * Automatically handles both touch and mouse input.
 * Shows keyboard shortcuts on hover when keyboardHints prop is provided.
 *
 * @example Horizontal pad
 * ```tsx
 * // Define movement handlers
 * const moveLeft = () => movePlayer('left');
 * const moveRight = () => movePlayer('right');
 *
 * // Register with game initialization
 * useInitializeGame({
 *   actions: {
 *     left: { handler: moveLeft, allowRepeat: true },
 *     right: { handler: moveRight, allowRepeat: true },
 *   }
 * });
 *
 * // Get handlers for buttons
 * const handlers = useGameActionHandlers();
 *
 * <DirectionalPad
 *   layout="horizontal"
 *   onLeft={handlers.left}
 *   onRight={handlers.right}
 * />
 * ```
 *
 * @example Full 4-way D-pad
 * ```tsx
 * <DirectionalPad
 *   layout="full"
 *   onLeft={() => move('left')}
 *   onRight={() => move('right')}
 *   onUp={() => move('up')}
 *   onDown={() => move('down')}
 * />
 * ```
 */
export function DirectionalPad({
  onLeft,
  onRight,
  onUp,
  onDown,
  layout = "horizontal",
  buttonSize = "w-12 h-12",
  className = "",
  keyboardHints,
}: DirectionalPadProps) {
  if (layout === "horizontal") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {onLeft && (
          <DirectionButton
            onPress={onLeft}
            buttonSize={buttonSize}
            label="←"
            ariaLabel="Move left"
            keyboardHint={keyboardHints?.left}
          />
        )}
        {onRight && (
          <DirectionButton
            onPress={onRight}
            buttonSize={buttonSize}
            label="→"
            ariaLabel="Move right"
            keyboardHint={keyboardHints?.right}
          />
        )}
      </div>
    );
  }

  if (layout === "vertical") {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {onUp && (
          <DirectionButton
            onPress={onUp}
            buttonSize={buttonSize}
            label="↑"
            ariaLabel="Move up"
            keyboardHint={keyboardHints?.up}
          />
        )}
        {onDown && (
          <DirectionButton
            onPress={onDown}
            buttonSize={buttonSize}
            label="↓"
            ariaLabel="Move down"
            keyboardHint={keyboardHints?.down}
          />
        )}
      </div>
    );
  }

  // Full 4-way D-pad - single horizontal row
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {onLeft && (
        <DirectionButton
          onPress={onLeft}
          buttonSize={buttonSize}
          label="←"
          ariaLabel="Move left"
          keyboardHint={keyboardHints?.left}
        />
      )}
      {onDown && (
        <DirectionButton
          onPress={onDown}
          buttonSize={buttonSize}
          label="↓"
          ariaLabel="Move down"
          keyboardHint={keyboardHints?.down}
        />
      )}
      {onUp && (
        <DirectionButton
          onPress={onUp}
          buttonSize={buttonSize}
          label="↑"
          ariaLabel="Move up"
          keyboardHint={keyboardHints?.up}
        />
      )}
      {onRight && (
        <DirectionButton
          onPress={onRight}
          buttonSize={buttonSize}
          label="→"
          ariaLabel="Move right"
          keyboardHint={keyboardHints?.right}
        />
      )}
    </div>
  );
}
