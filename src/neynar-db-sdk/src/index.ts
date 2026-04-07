/**
 * Neynar Database SDK
 *
 * This SDK provides server actions for database operations using Drizzle ORM.
 *
 * ## Available Exports
 *
 * ### KV Store Server Actions (Built-in)
 * - kvGet(key) - Get value by key
 * - kvSet(key, value) - Set or update value
 * - kvDelete(key) - Delete key
 * - kvKeys() - Get all keys
 * - kvGetAll() - Get all key-value pairs
 *
 * ## Usage Examples
 *
 * ### Using KV Store:
 * ```typescript
 * import { kvGet, kvSet } from '@/neynar-db-sdk';
 *
 * // Works in both client and server components
 * await kvSet('user:theme', 'dark');
 * const theme = await kvGet('user:theme');
 * ```
 *
 * ### Creating Custom Server Actions:
 *
 * **IMPORTANT**: Create server actions in `src/db/actions/`, NOT in neynar-db-sdk.
 *
 * ```typescript
 * // src/db/actions/game-actions.ts
 * "use server";
 *
 * import { db } from "@/neynar-db-sdk/db";
 * import { gameScores } from "@/db/schema";
 * import { desc, eq } from "drizzle-orm";
 *
 * export async function saveGameScore(fid: number, score: number) {
 *   await db.insert(gameScores).values({ fid, score });
 * }
 *
 * export async function getTopScores(limit: number = 10) {
 *   return db.select().from(gameScores).orderBy(desc(gameScores.score)).limit(limit);
 * }
 * ```
 *
 * Then import your server actions in components:
 * ```typescript
 * import { saveGameScore, getTopScores } from '@/db/actions/game-actions';
 * ```
 */

// KV Store Server Actions (Built-in)
// These are safe to import in any component
export { kvGet, kvSet, kvDelete, kvKeys, kvGetAll } from "./actions/kv-actions";

// ⚠️ DO NOT EXPORT db, schema, or query helpers from here
// They should only be imported in server action files using:
//   import { db } from "@/neynar-db-sdk/db"
//   import { myTable } from "@/db/schema"
//   import { eq, desc } from "drizzle-orm"
