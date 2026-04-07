"use client";

import { atom, useAtom } from "jotai";
import { useGameLoop } from "../initialization/use-game-loop";

export type Buff = {
  id: string;
  type: "positive" | "negative";
  stat: string;
  modifier: number;
  duration: number;
  icon?: string;
  activatedAt?: number;
  expiresAt?: number;
  timeRemaining?: number;
};

/**
 * Global buffs atom
 * Shared across all components that use useBuffs
 */
const activeBuffsAtom = atom<Buff[]>([]);

/**
 * Temporary stat buffs/debuffs hook (global)
 *
 * Tracks temporary stat modifiers with automatic expiration.
 * Calculates combined multipliers for stacking buffs.
 * State is shared globally across all components that use this hook.
 *
 * @returns Object with active buffs and management functions
 *
 * @example
 * ```typescript
 * const buffs = useBuffs();
 *
 * // Apply damage buff
 * buffs.applyBuff({
 *   id: 'rage',
 *   type: 'positive',
 *   stat: 'damage',
 *   modifier: 2.0,
 *   duration: 5000
 * });
 *
 * // Get combined modifier
 * const damageMultiplier = buffs.getModifier('damage');
 * const damage = baseDamage * damageMultiplier;
 * ```
 */
export function useBuffs() {
  const [activeBuffs, setActiveBuffs] = useAtom(activeBuffsAtom);

  useGameLoop(() => {
    if (activeBuffs.length === 0) return;

    const now = Date.now();
    setActiveBuffs((prev) => {
      return prev
        .map((buff) => ({
          ...buff,
          timeRemaining: buff.expiresAt ? Math.max(0, buff.expiresAt - now) : 0,
        }))
        .filter((buff) => !buff.timeRemaining || buff.timeRemaining > 0);
    });
  }, 10);

  function applyBuff(buff: Buff) {
    const now = Date.now();
    const newBuff: Buff = {
      ...buff,
      activatedAt: now,
      expiresAt: now + buff.duration,
      timeRemaining: buff.duration,
    };

    setActiveBuffs((prev) => {
      const filtered = prev.filter((b) => b.id !== buff.id);
      return [...filtered, newBuff];
    });
  }

  function removeBuff(id: string) {
    setActiveBuffs((prev) => prev.filter((b) => b.id !== id));
  }

  function getModifier(stat: string) {
    const relevantBuffs = activeBuffs.filter((b) => b.stat === stat);
    if (relevantBuffs.length === 0) return 1.0;

    return relevantBuffs.reduce((total, buff) => total * buff.modifier, 1.0);
  }

  return {
    activeBuffs,
    applyBuff,
    removeBuff,
    getModifier,
  };
}
