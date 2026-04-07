"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type CheckpointInfo = {
  label: string;
  timestamp: number;
  data: unknown;
};

type CheckpointsByType = Record<string, CheckpointInfo[]>;

// Single global checkpoint atom
const checkpointAtom = atomWithStorage<CheckpointsByType>(
  "game-checkpoints",
  {},
);

/**
 * Manual save points system with persistent storage
 *
 * Stores multiple labeled checkpoints organized by type/category to localStorage.
 * State is shared globally and persists across page reloads. Perfect for save points
 * in roguelikes, puzzle games, or any game needing multiple save states organized by
 * difficulty, mode, campaign, etc.
 *
 * ## Recommended Pattern: Wrap in a Domain-Specific Hook
 *
 * Instead of using this hook directly, wrap it in a feature-specific hook:
 *
 * ```typescript
 * // src/features/rpg/use-game-checkpoint.ts
 * import { useCheckpoint } from "@/neynar-farcaster-sdk/mini";
 *
 * type GameState = { health: number; score: number };
 *
 * export function useGameCheckpoint() {
 *   const { saveCheckpoint, loadCheckpoint, listCheckpoints, deleteCheckpoint, clearCheckpointType } = useCheckpoint();
 *
 *   return {
 *     save: (data: GameState, label?: string) => saveCheckpoint("rpg-game", data, label),
 *     load: (label: string) => loadCheckpoint<GameState>("rpg-game", label),
 *     list: () => listCheckpoints("rpg-game"),
 *     delete: (label: string) => deleteCheckpoint("rpg-game", label),
 *     clear: () => clearCheckpointType("rpg-game"),
 *   };
 * }
 *
 * // In your component
 * const checkpoint = useGameCheckpoint();
 * checkpoint.save({ health: 100, score: 50 }, "before-boss");
 * const saved = checkpoint.load("before-boss"); // Typed as GameState | null
 * ```
 *
 * **Benefits:**
 * - Type string ("rpg-game") defined once
 * - GameState type enforced automatically
 * - Simpler API (`.save()` vs `saveCheckpoint()`)
 * - Clear, focused hook for specific use case
 *
 * ## Storage Structure
 * Checkpoints are organized as:
 * ```
 * {
 *   "hard-mode": [checkpoint1, checkpoint2, ...],
 *   "easy-mode": [checkpoint1, checkpoint2, ...],
 * }
 * ```
 *
 * Each array maintains chronological order (oldest first, newest last).
 *
 * @returns Object with checkpoint management functions
 *
 * @example Basic save/load
 * ```typescript
 * type GameState = { level: number; health: number; coins: number };
 * const checkpoint = useCheckpoint();
 *
 * // Save current state to 'campaign' category
 * checkpoint.saveCheckpoint(
 *   'campaign',
 *   { level: 5, health: 100, coins: 50 },
 *   'before-boss' // optional label
 * );
 *
 * // Load specific checkpoint
 * const saved = checkpoint.loadCheckpoint<GameState>('campaign', 'before-boss');
 * if (saved) {
 *   // Restore game state
 *   setGameState(saved);
 * }
 *
 * // Load most recent checkpoint (no label)
 * const latest = checkpoint.loadCheckpoint<GameState>('campaign');
 * ```
 *
 * @example Multiple difficulty modes
 * ```typescript
 * const checkpoint = useCheckpoint();
 *
 * // Save to different difficulties
 * checkpoint.saveCheckpoint('easy', gameState, 'level-10');
 * checkpoint.saveCheckpoint('hard', gameState, 'level-5');
 * checkpoint.saveCheckpoint('expert', gameState, 'level-3');
 *
 * // List all save types
 * const difficulties = checkpoint.listTypes();
 * // ['easy', 'hard', 'expert']
 *
 * // List all saves for a difficulty (chronological order)
 * const hardSaves = checkpoint.listCheckpoints('hard');
 * // [{ label: 'level-1', timestamp: ..., data: {...} }, ...]
 * ```
 *
 * @example Management operations
 * ```typescript
 * const checkpoint = useCheckpoint();
 *
 * // Delete specific save
 * checkpoint.deleteCheckpoint('hard-mode', 'before-boss');
 *
 * // Clear all saves for a category
 * checkpoint.clearCheckpointType('hard-mode');
 *
 * // Nuclear option - clear everything
 * checkpoint.clearAllCheckpoints();
 * ```
 *
 * @example Shared across components
 * ```typescript
 * // Component A - Save game
 * function SaveButton() {
 *   const checkpoint = useCheckpoint();
 *   const saveGame = () => {
 *     checkpoint.saveCheckpoint('campaign', currentState);
 *   };
 *   return <button onClick={saveGame}>Save</button>;
 * }
 *
 * // Component B - Load menu (shares same checkpoints)
 * function LoadMenu() {
 *   const checkpoint = useCheckpoint();
 *   const saves = checkpoint.listCheckpoints('campaign');
 *   return saves.map(save => (
 *     <button onClick={() => loadGame(save.data)}>
 *       {save.label}
 *     </button>
 *   ));
 * }
 * ```
 */
export function useCheckpoint() {
  const checkpoints = useAtomValue(checkpointAtom);
  const setCheckpoints = useSetAtom(checkpointAtom);

  function saveCheckpoint(type: string, data: unknown, label?: string) {
    const checkpointLabel = label || new Date().toISOString();
    setCheckpoints((prev: CheckpointsByType) => {
      const typeCheckpoints = prev[type] || [];
      return {
        ...prev,
        [type]: [
          ...typeCheckpoints,
          {
            label: checkpointLabel,
            timestamp: Date.now(),
            data,
          },
        ],
      };
    });
  }

  function loadCheckpoint<T = unknown>(type: string, label?: string): T | null {
    const typeCheckpoints = checkpoints[type];
    if (!typeCheckpoints || typeCheckpoints.length === 0) return null;

    if (label) {
      // Load specific checkpoint by label
      const checkpoint = typeCheckpoints.find(
        (cp: CheckpointInfo) => cp.label === label,
      );
      return checkpoint ? (checkpoint.data as T) : null;
    } else {
      // Load most recent checkpoint (last in array)
      return typeCheckpoints[typeCheckpoints.length - 1].data as T;
    }
  }

  function listCheckpoints(type: string): CheckpointInfo[] {
    return checkpoints[type] || [];
  }

  function listTypes(): string[] {
    return Object.keys(checkpoints);
  }

  function deleteCheckpoint(type: string, label: string) {
    setCheckpoints((prev: CheckpointsByType) => {
      const typeCheckpoints = prev[type];
      if (!typeCheckpoints) return prev;

      return {
        ...prev,
        [type]: typeCheckpoints.filter(
          (cp: CheckpointInfo) => cp.label !== label,
        ),
      };
    });
  }

  function clearCheckpointType(type: string) {
    setCheckpoints((prev: CheckpointsByType) => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });
  }

  function clearAllCheckpoints() {
    setCheckpoints({});
  }

  return {
    saveCheckpoint,
    loadCheckpoint,
    listCheckpoints,
    listTypes,
    deleteCheckpoint,
    clearCheckpointType,
    clearAllCheckpoints,
  };
}
