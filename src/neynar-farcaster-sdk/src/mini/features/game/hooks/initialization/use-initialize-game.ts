"use client";

import { useSetAtom } from "jotai";
import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import {
  useSetActiveGameActions,
  useGameControlsEnabled,
  useSetGameActionHandlers,
  gameConfigAtom,
} from "../use-game-state";
import type {
  GameAction,
  GameActionHandler,
  GameActionHandlers,
  GameConfig,
} from "../../private/types";
import { DEFAULT_KEY_BINDINGS } from "../../private/types";

// Re-export types and atom for public API
export type { GameAction, GameActionHandler, GameActionHandlers, GameConfig };
export { gameConfigAtom };

/**
 * Hook to initialize game configuration
 * Call once at the root of your game to set config values
 *
 * @internal - Used by useInitializeGame
 */
function useSetGameConfig(config?: Partial<GameConfig>) {
  const setGameConfig = useSetAtom(gameConfigAtom);
  const allowNegativeScore = config?.allowNegativeScore;

  useEffect(() => {
    if (allowNegativeScore !== undefined) {
      setGameConfig({
        allowNegativeScore,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowNegativeScore]);
}

/**
 * Parameters for useInitializeGame hook
 * Combines game state config and keyboard controls config
 */
type UseInitializeGameParams = {
  /**
   * Allow score to go below 0
   * @default false
   */
  allowNegativeScore?: boolean;

  /**
   * Map of actions to their handler config
   * Each action can specify its own keys, handler, rateLimitMs, and allowRepeat
   */
  actions?: GameActionHandlers;
};

/**
 * Key conflict information
 */
type KeyConflict = {
  key: string;
  actions: GameAction[];
};

/**
 * Detects conflicts where the same key is bound to multiple actions
 * Only checks actions that are actually provided (have handlers)
 */
function detectKeyConflicts(
  bindings: Record<GameAction, string[]>,
  activeActions: GameActionHandlers,
): KeyConflict[] {
  const keyToActions = new Map<string, GameAction[]>();

  Object.entries(bindings).forEach(([action, keys]) => {
    // Only check bindings for actions that have handlers
    if (!activeActions[action as GameAction]) return;

    keys.forEach((key) => {
      const existing = keyToActions.get(key) || [];
      existing.push(action as GameAction);
      keyToActions.set(key, existing);
    });
  });

  const conflicts: KeyConflict[] = [];
  keyToActions.forEach((actions, key) => {
    if (actions.length > 1) {
      conflicts.push({ key, actions });
    }
  });

  return conflicts;
}

/**
 * Creates a map of key -> action for fast lookup
 * Only includes actions that have handlers
 */
function createKeyToActionMap(
  bindings: Record<GameAction, string[]>,
  activeActions: GameActionHandlers,
): Map<string, GameAction> {
  return (Object.entries(bindings) as [GameAction, string[]][]).reduce(
    (map, [action, keys]) => {
      // Only map keys for actions that have handlers
      if (!activeActions[action]) return map;

      keys.forEach((key) => map.set(key, action));
      return map;
    },
    new Map<string, GameAction>(),
  );
}

/**
 * Build key bindings from actions, using defaults for standard actions
 * and custom keys where specified
 */
function buildKeyBindings(
  actions: GameActionHandlers,
): Record<GameAction, string[]> {
  const bindings: Partial<Record<GameAction, string[]>> = {};

  for (const [action, config] of Object.entries(actions) as [
    GameAction,
    GameActionHandler,
  ][]) {
    // Use custom keys if provided, otherwise use default for standard actions
    bindings[action] = config.keys || DEFAULT_KEY_BINDINGS[action] || [];
  }

  return bindings as Record<GameAction, string[]>;
}

/**
 * Initialize game configuration and action handlers
 *
 * This hook combines game config initialization and action handler setup.
 * Call this once at the top level of your game component.
 *
 * @param options - Configuration and action handlers
 * @returns void
 *
 * @example
 * ```typescript
 * function PlayTab() {
 *   useInitializeGame({
 *     allowNegativeScore: true,
 *     actions: {
 *       // Standard action - uses default keys (Enter, e, E)
 *       action: {
 *         handler: () => addScore(10),
 *       },
 *       // Standard action with custom keys
 *       left: {
 *         keys: ['a', 'A'], // Override default ArrowLeft
 *         handler: () => movePlayer('left'),
 *         allowRepeat: true,
 *       },
 *       // Standard action with config
 *       jump: {
 *         handler: () => playerJump(),
 *         allowRepeat: false, // Must release to jump again
 *       },
 *       // Custom action with custom keys
 *       shoot: {
 *         keys: ['Space', 'f', 'F'],
 *         handler: () => fireBullet(),
 *         rateLimitMs: 100, // Max 10 shots per second
 *       },
 *     },
 *   });
 *
 *   // Now use other game hooks
 *   const { score } = useScore();
 *   // ...
 * }
 * ```
 */
export function useInitializeGame(options?: UseInitializeGameParams) {
  const setActiveKeys = useSetActiveGameActions();
  const setHandlers = useSetGameActionHandlers();
  const enabled = useGameControlsEnabled();

  // Initialize game configuration (shared state only)
  useSetGameConfig({ allowNegativeScore: options?.allowNegativeScore });

  // Separate handler functions from configuration
  // This prevents unnecessary re-renders when handler references change
  const actions = options?.actions || {};

  // Store current handlers in a ref so they're always up-to-date
  const handlersRef = useRef<Partial<Record<GameAction, () => void>>>({});
  useEffect(() => {
    Object.entries(actions).forEach(([action, config]) => {
      handlersRef.current[action as GameAction] = config.handler;
    });
  });

  // Memoize action configuration (everything except handlers)
  // Only re-run effects when the actual configuration changes, not handler references
  const actionConfigKey = JSON.stringify(
    Object.entries(actions).reduce(
      (acc, [action, handler]) => ({
        ...acc,
        [action]: {
          keys: handler.keys,
          allowRepeat: handler.allowRepeat,
          rateLimitMs: handler.rateLimitMs,
        },
      }),
      {},
    ),
  );

  const actionConfig = useMemo(() => {
    const config: Record<string, Omit<GameActionHandler, "handler">> = {};
    Object.entries(actions).forEach(([action, handler]) => {
      config[action] = {
        keys: handler.keys,
        allowRepeat: handler.allowRepeat,
        rateLimitMs: handler.rateLimitMs,
      };
    });
    return config;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only depend on config, not handlers
  }, [actionConfigKey]);

  const lastTriggerTime = useRef<Map<GameAction, number>>(new Map());

  const keyBindingsRef = useRef<Partial<Record<GameAction, string[]>>>({});
  const keyToActionMapRef = useRef<Map<string, GameAction>>(new Map());
  const hasDetectedConflicts = useRef(false);

  // Update bindings when action configuration changes (not handler references)
  useEffect(() => {
    // Reconstruct actions with current handlers from ref
    const currentActions: GameActionHandlers = {};
    Object.entries(actionConfig).forEach(([action, config]) => {
      currentActions[action as GameAction] = {
        ...config,
        handler: handlersRef.current[action as GameAction] || (() => {}),
      };
    });

    // Build key bindings from actions (each action can specify its own keys)
    keyBindingsRef.current = buildKeyBindings(currentActions);

    keyToActionMapRef.current = createKeyToActionMap(
      keyBindingsRef.current as Record<GameAction, string[]>,
      currentActions,
    );

    // Detect conflicts when bindings change (but only log once)
    // Only check for conflicts among actions that actually have handlers
    if (
      !hasDetectedConflicts.current &&
      Object.keys(currentActions).length > 0
    ) {
      const conflicts = detectKeyConflicts(
        keyBindingsRef.current as Record<GameAction, string[]>,
        currentActions,
      );
      if (conflicts.length > 0) {
        console.warn(
          "[useInitializeGame] Key binding conflicts detected:",
          conflicts.map(
            (c) =>
              `Key "${c.key}" is bound to multiple actions: ${c.actions.join(", ")}`,
          ),
        );
        hasDetectedConflicts.current = true;
      }
    }
  }, [actionConfig]);

  const keyToActionMap = keyToActionMapRef.current;

  const shouldRateLimitRef = useRef(
    (action: GameAction, rateLimitMs: number): boolean => {
      if (rateLimitMs === 0) return false;

      const lastTime = lastTriggerTime.current.get(action) || 0;
      const now = Date.now();
      const timeSinceLastTrigger = now - lastTime;

      if (timeSinceLastTrigger < rateLimitMs) {
        return true;
      }

      lastTriggerTime.current.set(action, now);
      return false;
    },
  );

  const shouldRateLimit = shouldRateLimitRef.current;

  // Use useEffectEvent to stabilize the handler while always accessing latest values
  const executeAction = useEffectEvent((action: GameAction) => {
    const handler = handlersRef.current[action];
    if (handler) {
      handler();
    }
  });

  // Keyboard event handlers
  useEffect(() => {
    if (!enabled || Object.keys(actionConfig).length === 0) return;

    function handleKeyDown(e: KeyboardEvent) {
      const action = keyToActionMap.get(e.key);
      if (!action) return;

      const config = actionConfig[action];
      if (!config) return;

      // Check per-action allowRepeat setting
      if (e.repeat && !(config.allowRepeat ?? true)) return;

      // Check per-action rate limit
      if (shouldRateLimit(action, config.rateLimitMs ?? 0)) return;

      e.preventDefault();

      setActiveKeys((prev: Set<GameAction>) => new Set(prev).add(action));
      executeAction(action);
    }

    function handleKeyUp(e: KeyboardEvent) {
      const action = keyToActionMap.get(e.key);
      if (action) {
        setActiveKeys((prev: Set<GameAction>) => {
          const next = new Set(prev);
          next.delete(action);
          return next;
        });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    actionConfig,
    enabled,
    keyToActionMap,
    shouldRateLimit,
    setActiveKeys,
    executeAction,
  ]);

  // Create and store handlers globally for touch controls.
  // Only rebuild when actionConfig changes — shouldRateLimit (ref),
  // executeAction (useEffectEvent), setActiveKeys and setHandlers
  // (Jotai setters) are all stable references.
  useEffect(() => {
    if (Object.keys(actionConfig).length === 0) return;

    function createHandler(action: GameAction) {
      return () => {
        const config = actionConfig[action];
        if (!config) return;

        if (shouldRateLimit(action, config.rateLimitMs ?? 0)) return;

        setActiveKeys((prev: Set<GameAction>) => new Set(prev).add(action));
        executeAction(action);

        setTimeout(() => {
          setActiveKeys((prev: Set<GameAction>) => {
            const next = new Set(prev);
            next.delete(action);
            return next;
          });
        }, 150);
      };
    }

    const handlers = {
      left: createHandler("left"),
      right: createHandler("right"),
      up: createHandler("up"),
      down: createHandler("down"),
      jump: createHandler("jump"),
      action: createHandler("action"),
      action2: createHandler("action2"),
      pause: createHandler("pause"),
      select: createHandler("select"),
    };

    setHandlers(handlers);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shouldRateLimit (ref), executeAction (useEffectEvent), setActiveKeys/setHandlers (Jotai setters) are stable
  }, [actionConfig]);
}
