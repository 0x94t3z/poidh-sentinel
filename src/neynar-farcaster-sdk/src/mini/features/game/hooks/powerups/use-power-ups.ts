"use client";

import { atom, useAtom } from "jotai";
import { useGameLoop } from "../initialization/use-game-loop";

export type PowerUpDefinition = {
  id: string;
  name: string;
  duration: number;
  icon?: string;
};

export type ActivePowerUp = PowerUpDefinition & {
  activatedAt: number;
  expiresAt: number;
  timeRemaining: number;
};

/**
 * Global power-ups atoms
 * Shared across all components that use usePowerUps
 */
const activePowerUpsAtom = atom<ActivePowerUp[]>([]);
const powerUpDefinitionsAtom = atom<PowerUpDefinition[]>([]);

/**
 * Power-up management hook (global)
 *
 * Manages active power-ups with duration timers.
 * Auto-deactivates when timer expires.
 * State is shared globally across all components that use this hook.
 *
 * @param definitions - Power-up definitions
 * @returns Object with active power-ups and control functions
 *
 * @example
 * ```typescript
 * const powerUps = usePowerUps([
 *   { id: 'shield', name: 'Shield', duration: 10000 },
 *   { id: 'speed', name: 'Speed Boost', duration: 5000 }
 * ]);
 *
 * // Activate power-up
 * powerUps.activate('shield');
 *
 * // Check if active
 * if (powerUps.isActive('shield')) {
 *   // Player is invincible
 * }
 * ```
 */
export function usePowerUps(definitions: PowerUpDefinition[]) {
  const [activePowerUps, setActivePowerUps] = useAtom(activePowerUpsAtom);
  const [, setDefinitions] = useAtom(powerUpDefinitionsAtom);

  // Store definitions globally
  if (definitions.length > 0) {
    setDefinitions(definitions);
  }

  useGameLoop(() => {
    if (activePowerUps.length === 0) return;

    const now = Date.now();
    setActivePowerUps((prev) => {
      return prev
        .map((powerUp) => ({
          ...powerUp,
          timeRemaining: Math.max(0, powerUp.expiresAt - now),
        }))
        .filter((powerUp) => powerUp.timeRemaining > 0);
    });
  }, 10);

  function activate(id: string) {
    const definition = definitions.find((d) => d.id === id);
    if (!definition) return;

    const now = Date.now();
    const newPowerUp: ActivePowerUp = {
      ...definition,
      activatedAt: now,
      expiresAt: now + definition.duration,
      timeRemaining: definition.duration,
    };

    setActivePowerUps((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return [...filtered, newPowerUp];
    });
  }

  function deactivate(id: string) {
    setActivePowerUps((prev) => prev.filter((p) => p.id !== id));
  }

  function isActive(id: string) {
    return activePowerUps.some((p) => p.id === id);
  }

  function getTimeRemaining(id: string) {
    const powerUp = activePowerUps.find((p) => p.id === id);
    return powerUp?.timeRemaining || 0;
  }

  return {
    activePowerUps,
    activate,
    deactivate,
    isActive,
    getTimeRemaining,
  };
}
