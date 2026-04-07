"use server";

import { db } from "../db";
import { kv } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Server Actions for Key-Value Store Operations
 *
 * These server actions can be imported and called from:
 * - Server components (async components with no 'use client')
 * - Client components (components with 'use client')
 * - Other server actions
 *
 * Example usage:
 * ```tsx
 * import { kvGet, kvSet } from '@/neynar-db-sdk';
 *
 * // Works in any component
 * await kvSet('user:theme', 'dark');
 * const theme = await kvGet('user:theme');
 * ```
 */

/**
 * Get a value from the KV store
 */
export async function kvGet(key: string): Promise<string | null> {
  const result = await db.select().from(kv).where(eq(kv.key, key)).limit(1);
  return result[0]?.value ?? null;
}

/**
 * Set a value in the KV store (creates or updates)
 */
export async function kvSet(key: string, value: string): Promise<void> {
  await db.insert(kv).values({ key, value }).onConflictDoUpdate({
    target: kv.key,
    set: { value },
  });
}

/**
 * Delete a key from the KV store
 */
export async function kvDelete(key: string): Promise<void> {
  await db.delete(kv).where(eq(kv.key, key));
}

/**
 * Get all keys from the KV store
 */
export async function kvKeys(): Promise<string[]> {
  const results = await db.select({ key: kv.key }).from(kv);
  return results.map((r) => r.key);
}

/**
 * Get all key-value pairs from the KV store
 */
export async function kvGetAll(): Promise<Record<string, string>> {
  const results = await db.select().from(kv);
  return results.reduce(
    (acc, r) => {
      acc[r.key] = r.value;
      return acc;
    },
    {} as Record<string, string>,
  );
}
