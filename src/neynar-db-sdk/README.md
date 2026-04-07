# Neynar Database SDK

PostgreSQL database utilities with Drizzle ORM for Neynar miniapps.

## Server Actions Pattern (Recommended)

All database operations use Next.js server actions that can be called from both client and server components.

### Built-in KV Store

The KV table is available immediately with these server actions:

```typescript
import { kvGet, kvSet } from "@/neynar-db-sdk";
import { useState } from 'react';

// Use in client components
'use client';
function MyComponent({ fid }: { fid: number }) {
  const [theme, setTheme] = useState<string | null>(null);

  const handleSave = async () => {
    await kvSet(`user:${fid}:theme`, "dark");
    const savedTheme = await kvGet(`user:${fid}:theme`);
    setTheme(savedTheme);
  };

  return <button onClick={handleSave}>Save Theme</button>;
}

// Use in server components
async function MyServerComponent({ fid }: { fid: number }) {
  const theme = await kvGet(`user:${fid}:theme`);
  return <div>Theme: {theme ?? 'default'}</div>;
}
```

### Custom Tables with Server Actions

When you need queryable data, create custom tables with server actions.

## Adding New Tables

⚠️ **CRITICAL**: The base schema only includes a `kv` table. To add custom tables, you MUST create server actions.

**Step 1: Edit** `src/db/schema.ts` to add your tables.

Here's the base schema:

```typescript
import { pgTable, text } from "drizzle-orm/pg-core";

export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
```

**Add your custom tables below**. Example - adding a `game_scores` table:

```typescript
import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";

export const kv = pgTable("kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// Add your custom tables here
export const gameScores = pgTable("game_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  fid: integer("fid").notNull(),
  score: integer("score").notNull(),
  username: text("username").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Drizzle Column Types**:

- `text("column_name")` - Text data
- `integer("column_name")` - Integer numbers
- `real("column_name")` - Decimal numbers
- `boolean("column_name")` - True/false
- `timestamp("column_name")` - Timestamps
- `uuid("column_name")` - UUID
- `json("column_name")` - JSON data

**Common Modifiers**:

- `.primaryKey()` - Primary key
- `.notNull()` - Required field
- `.unique()` - Unique constraint
- `.default(value)` - Default value
- `.defaultRandom()` - Auto-generate UUID
- `.defaultNow()` - Current timestamp
- Without `.notNull()` - Optional field

**Step 2: Push schema to database and restart dev server**:

```bash
pnpm run db:push
```

Then restart the dev server:

```bash
/dev-restart
```

**Why restart?** The database client is cached to prevent connection spam during hot reloads. After pushing schema changes, you must restart the dev server to reload the client with the new schema.

The `pnpm run db:push` command:

- Creates tables in PostgreSQL
- Handles conflicts with `--force` (may lose data in dev)

**Step 3: Create server actions**

Create `src/db/actions/game-actions.ts`:

```typescript
"use server";

import { db } from "@/neynar-db-sdk/db";
import { gameScores } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function saveGameScore(
  fid: number,
  score: number,
  username: string,
) {
  await db.insert(gameScores).values({ fid, score, username });
}

export async function getTopScores(limit: number = 10) {
  return db
    .select()
    .from(gameScores)
    .orderBy(desc(gameScores.score))
    .limit(limit);
}

export async function getUserBestScore(fid: number) {
  const result = await db
    .select()
    .from(gameScores)
    .where(eq(gameScores.fid, fid))
    .orderBy(desc(gameScores.score))
    .limit(1);
  return result[0] ?? null;
}
```

**Step 4: Use in your app**

```typescript
// Client component
'use client';
import { saveGameScore, getTopScores } from "@/db/actions/game-actions"
import { useState, useEffect } from 'react';

function GameComponent({ fid, username }: { fid: number, username: string }) {
  const [scores, setScores] = useState([]);

  useEffect(() => {
    getTopScores(10).then(setScores);
  }, []);

  const handleGameEnd = async (score: number) => {
    await saveGameScore(fid, score, username);
    const topScores = await getTopScores(10);
    setScores(topScores);
  };

  return (
    <div>
      <button onClick={() => handleGameEnd(100)}>Save Score</button>
      <ul>
        {scores.map((s) => (
          <li key={s.id}>{s.username}: {s.score}</li>
        ))}
      </ul>
    </div>
  );
}

// Server component
import { getTopScores } from '@/db/actions/game-actions';

async function LeaderboardServer() {
  const scores = await getTopScores(10);
  return (
    <ul>
      {scores.map((s) => (
        <li key={s.id}>{s.username}: {s.score}</li>
      ))}
    </ul>
  );
}
```

## Migration Workflow

**Every time you add/modify tables:**

1. Edit `src/db/schema.ts`
2. Run `pnpm run db:push`
3. Run `/dev-restart` to reload database client
4. Create server actions in `src/db/actions/`
5. Use your server actions in components (import from @/db/actions/)

**Key Benefits:**

- ✅ TypeScript types update immediately when you edit schema.ts
- ✅ Server actions work from any component type
- ✅ Simple workflow: edit schema, push, restart

## Available Built-in Server Actions

### KV Store (Ready to use)

- `kvGet(key)` - Get value by key
- `kvSet(key, value)` - Set or update value
- `kvDelete(key)` - Delete key
- `kvKeys()` - Get all keys
- `kvGetAll()` - Get all key-value pairs

### For Custom Tables

Create your own server actions in `src/db/actions/` using:

- `db` from `@/neynar-db-sdk/db` - Drizzle database client
- Table definitions from `@/db/schema` - Your custom tables
- Query helpers from `drizzle-orm` - `eq`, `desc`, `asc`, `and`, `or`, `sql`

## Common Query Patterns

```typescript
import { db } from "@/neynar-db-sdk/db";
import { gameScores } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

// Insert
await db.insert(gameScores).values({ fid, score, username });

// Select all
const all = await db.select().from(gameScores);

// Select with where
const results = await db
  .select()
  .from(gameScores)
  .where(eq(gameScores.fid, fid));

// Select with order and limit
const top = await db
  .select()
  .from(gameScores)
  .orderBy(desc(gameScores.score))
  .limit(10);

// Update
await db.update(gameScores).set({ score: 100 }).where(eq(gameScores.id, id));

// Delete
await db.delete(gameScores).where(eq(gameScores.id, id));

// Upsert
await db.insert(gameScores).values({ id, score }).onConflictDoUpdate({
  target: gameScores.id,
  set: { score },
});
```

## Environment

Requires `DATABASE_URL` environment variable (automatically provided by deployment platform).

If `DATABASE_URL` is not set, all database operations are skipped, allowing apps to run without a database.
