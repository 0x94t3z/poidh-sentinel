"use client";

import type { ReactNode } from "react";

export type InventoryGridProps<T> = {
  items: T[];
  renderItem: (item: T) => ReactNode;
  columns?: number;
  onItemClick?: (item: T) => void;
  className?: string;
};

/**
 * Inventory grid component
 *
 * Visual inventory display with grid layout and custom item rendering.
 * Supports item click handling.
 *
 * @example
 * ```typescript
 * const inventory = useInventory<Item>();
 *
 * <InventoryGrid
 *   items={inventory.items}
 *   columns={4}
 *   renderItem={(item) => (
 *     <div>{item.name}</div>
 *   )}
 *   onItemClick={(item) => console.log('Clicked:', item)}
 * />
 * ```
 */
export function InventoryGrid<T>({
  items,
  renderItem,
  columns = 4,
  onItemClick,
  className = "",
}: InventoryGridProps<T>) {
  return (
    <div
      className={`grid gap-2 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          onClick={() => onItemClick?.(item)}
          className={`border-2 border-gray-300 rounded-lg p-2 ${
            onItemClick ? "cursor-pointer hover:border-blue-500" : ""
          }`}
        >
          {renderItem(item)}
        </div>
      ))}
    </div>
  );
}
