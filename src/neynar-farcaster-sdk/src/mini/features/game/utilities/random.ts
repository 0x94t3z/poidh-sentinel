/**
 * Random number utilities for games
 *
 * Pure functions for generating random values, picking from arrays,
 * shuffling, and weighted random selection.
 */

/**
 * Generate random integer between min and max (inclusive)
 *
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (inclusive)
 * @returns Random integer in range [min, max]
 *
 * @example
 * ```typescript
 * // Roll a die
 * const roll = randomInt(1, 6);
 *
 * // Random spawn position
 * const x = randomInt(0, 800);
 * ```
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Pick random element from array
 *
 * @param array - Array to pick from
 * @returns Random element from the array
 *
 * @example
 * ```typescript
 * // Pick random color
 * const color = randomChoice(['red', 'blue', 'green']);
 *
 * // Pick random enemy type
 * const enemy = randomChoice(enemyTypes);
 * ```
 */
export function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 * Returns new array, doesn't modify original
 *
 * @param array - Array to shuffle
 * @returns New shuffled array
 *
 * @example
 * ```typescript
 * // Shuffle deck of cards
 * const deck = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const shuffled = shuffle(deck);
 *
 * // Randomize level order
 * const levels = shuffle(['easy', 'medium', 'hard']);
 * ```
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick item based on weights
 *
 * @param items - Array of items with weight values
 * @returns Random item based on weighted probability
 *
 * @example
 * ```typescript
 * // Loot drop system
 * const loot = weightedRandom([
 *   { value: 'common', weight: 70 },
 *   { value: 'rare', weight: 25 },
 *   { value: 'legendary', weight: 5 }
 * ]);
 * // Returns 'common' ~70% of the time, 'rare' ~25%, 'legendary' ~5%
 *
 * // Enemy spawn rates
 * const enemy = weightedRandom([
 *   { value: 'goblin', weight: 50 },
 *   { value: 'orc', weight: 30 },
 *   { value: 'dragon', weight: 1 }
 * ]);
 * ```
 */
export function weightedRandom<T>(items: { value: T; weight: number }[]): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;

  for (const item of items) {
    if (random < item.weight) return item.value;
    random -= item.weight;
  }

  return items[items.length - 1].value;
}
