"use client";

import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useMemo } from "react";

/**
 * State that persists to localStorage
 *
 * Works exactly like useState but syncs to localStorage automatically.
 * Uses Jotai's atomWithStorage internally with namespaced keys.
 *
 * ## Recommended Pattern: Wrap in a Domain-Specific Hook
 *
 * Instead of using this hook directly, wrap it in a feature-specific hook:
 *
 * ```typescript
 * // src/features/game/use-high-score.ts
 * import { useLocalStorageState } from "@/neynar-farcaster-sdk/mini";
 *
 * export function useHighScore() {
 *   return useLocalStorageState<number>("high-score", 0);
 * }
 *
 * // In your component
 * const [highScore, setHighScore] = useHighScore();
 * if (score > highScore) {
 *   setHighScore(score); // Automatically saves to localStorage
 * }
 * ```
 *
 * **Benefits:**
 * - Storage key defined once
 * - Type enforced automatically
 * - Clear, focused hook for specific use case
 * - Easy to mock in tests
 *
 * @param key - Storage key (will be namespaced as "neynar-miniapp:{key}")
 * @param initialValue - Initial value if no stored value exists
 * @returns Tuple of [value, setValue] like useState
 *
 * @example Direct usage (not recommended for production)
 * ```typescript
 * // Persistent high score
 * const [highScore, setHighScore] = useLocalStorageState('high-score', 0);
 * if (score > highScore) {
 *   setHighScore(score); // Automatically saves to localStorage
 * }
 *
 * // Persistent settings
 * const [settings, setSettings] = useLocalStorageState('settings', {
 *   volume: 0.5,
 *   difficulty: 'normal'
 * });
 *
 * // Works with any type
 * const [level, setLevel] = useLocalStorageState('current-level', 1);
 * const [unlocked, setUnlocked] = useLocalStorageState<string[]>('unlocked-items', []);
 * ```
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // Create namespaced key
  const storageKey = `neynar-miniapp:${key}`;

  // Create atom with storage (memoized to avoid recreating on each render)
  const atom = useMemo(
    () => atomWithStorage<T>(storageKey, initialValue),
    [storageKey, initialValue],
  );

  // Use the atom
  const [value, setValue] = useAtom(atom);

  return [value, setValue];
}
