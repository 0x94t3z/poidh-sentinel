/**
 * Internal game types and constants
 *
 * These types and constants are used internally across game features.
 * Some are re-exported publicly for developer use.
 *
 * @internal (implementation detail, but some are publicly exported)
 */

/**
 * Game action types that can be mapped to both keyboard and touch controls
 */
export type GameAction =
  | "left"
  | "right"
  | "up"
  | "down"
  | "jump"
  | "action"
  | "action2"
  | "pause"
  | "select";

/**
 * Configuration for a single action handler
 */
export type GameActionHandler = {
  /**
   * The handler function to call when the action is triggered
   */
  handler: () => void;

  /**
   * Custom keyboard bindings for this action
   * If not provided, uses DEFAULT_KEY_BINDINGS for standard actions
   * Required for custom actions not in the GameAction enum
   */
  keys?: string[];

  /**
   * Rate limit in milliseconds - prevents action from firing too frequently
   * @default 0 (no rate limit)
   */
  rateLimitMs?: number;

  /**
   * Whether to allow key repeat (holding down a key)
   * If false, you must release and press again to trigger
   * @default true
   */
  allowRepeat?: boolean;
};

/**
 * Map of game actions to their handler config
 */
export type GameActionHandlers = Partial<Record<GameAction, GameActionHandler>>;

/**
 * Global game configuration (shared state across hooks)
 * This is stored in an atom so all game hooks can access it
 */
export type GameConfig = {
  /**
   * Allow score to go below 0
   * Default: false (score clamped at 0)
   * Set to true for golf games, penalty systems, etc.
   */
  allowNegativeScore: boolean;
};

/**
 * Default keyboard bindings for common game actions
 * @internal - implementation detail, not typically customized
 */
export const DEFAULT_KEY_BINDINGS: Record<GameAction, string[]> = {
  left: ["ArrowLeft", "a", "A"],
  right: ["ArrowRight", "d", "D"],
  up: ["ArrowUp", "w", "W"],
  down: ["ArrowDown", "s", "S"],
  jump: [" ", "w", "W"],
  action: ["Enter", "e", "E"],
  action2: ["Shift", "q", "Q"],
  pause: ["Escape", "p", "P"],
  select: ["Enter", " "],
};
