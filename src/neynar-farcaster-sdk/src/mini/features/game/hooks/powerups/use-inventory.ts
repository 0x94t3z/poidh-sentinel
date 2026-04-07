"use client";

import { atom, useAtom } from "jotai";

/**
 * Global inventory atom
 * Shared across all components that use useInventory
 */
const inventoryAtom = atom<{ id: string }[]>([]);

/**
 * Simple inventory system hook (global)
 *
 * Stores collected items with deduplication by ID.
 * State is shared globally across all components that use this hook.
 *
 * @returns Object with items array and management functions
 *
 * @example
 * ```typescript
 * const inventory = useInventory();
 *
 * // Collect item
 * inventory.addItem({ id: 'key' });
 *
 * // Check if has item
 * if (inventory.hasItem('key')) {
 *   // Can unlock door
 * }
 * ```
 */
export function useInventory() {
  const [items, setItems] = useAtom(inventoryAtom);

  function addItem(item: { id: string }) {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) {
        return prev;
      }
      return [...prev, item];
    });
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function hasItem(id: string) {
    return items.some((item) => item.id === id);
  }

  function getItem(id: string) {
    return items.find((item) => item.id === id);
  }

  function clear() {
    setItems([]);
  }

  return {
    items,
    addItem,
    removeItem,
    hasItem,
    getItem,
    count: items.length,
    clear,
  };
}
