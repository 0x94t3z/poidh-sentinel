#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(envPath);

const isDryRun = process.argv.includes("--dry-run");

const sourceUrl = process.env.OLD_DATABASE_URL ?? process.env.DATABASE_URL;
const targetUrl = process.env.NEW_DATABASE_URL;
const sourceName = process.env.OLD_DATABASE_URL ? "OLD_DATABASE_URL" : "DATABASE_URL";

if (!sourceUrl) {
  console.error("Missing source DB URL. Set OLD_DATABASE_URL (preferred) or DATABASE_URL.");
  process.exit(1);
}
if (!targetUrl) {
  console.error("Missing NEW_DATABASE_URL.");
  process.exit(1);
}

if (sourceUrl === targetUrl) {
  console.log(`${sourceName} and NEW_DATABASE_URL are identical. Nothing to migrate.`);
  process.exit(0);
}

const source = postgres(sourceUrl, { max: 1, prepare: false });
const target = postgres(targetUrl, { max: 1, prepare: false });

const createStatements = [
  `CREATE TABLE IF NOT EXISTS kv (
    key text PRIMARY KEY,
    value text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversation_state (
    thread_hash text PRIMARY KEY,
    step text NOT NULL,
    author_fid integer NOT NULL,
    author_username text NOT NULL,
    suggested_idea jsonb,
    chain text,
    amount_eth text,
    unique_amount text,
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS pending_payments (
    thread_hash text PRIMARY KEY,
    cast_hash text NOT NULL,
    state jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS active_bounties (
    bounty_id text PRIMARY KEY,
    tx_hash text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    amount_eth text NOT NULL,
    chain text NOT NULL,
    cast_hash text NOT NULL,
    creator_fid integer,
    announcement_cast_hash text,
    status text NOT NULL DEFAULT 'open',
    winner_claim_id text,
    winner_tx_hash text,
    winner_reasoning text,
    bounty_type text NOT NULL DEFAULT 'open',
    all_eval_results jsonb,
    last_checked_at timestamp,
    claim_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS bounty_threads (
    cast_hash text PRIMARY KEY,
    bounty_id text NOT NULL,
    bounty_name text NOT NULL,
    bounty_description text NOT NULL,
    chain text NOT NULL,
    poidh_url text,
    winner_claim_id text,
    winner_issuer text,
    winner_reasoning text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS bot_log (
    id text PRIMARY KEY,
    timestamp timestamp NOT NULL DEFAULT now(),
    trigger_cast_hash text NOT NULL,
    trigger_author text NOT NULL,
    trigger_text text NOT NULL,
    action text NOT NULL,
    reply_text text NOT NULL,
    status text NOT NULL,
    error_message text,
    tx_hash text
  )`,
  `CREATE INDEX IF NOT EXISTS bot_log_timestamp_idx ON bot_log (timestamp)`,
  `CREATE TABLE IF NOT EXISTS processed_casts (
    cast_hash text PRIMARY KEY,
    processed_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_balances (
    balance_key text PRIMARY KEY,
    balance text NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
];

const tables = [
  { name: "kv", conflict: ["key"] },
  { name: "conversation_state", conflict: ["thread_hash"] },
  { name: "pending_payments", conflict: ["thread_hash"] },
  { name: "active_bounties", conflict: ["bounty_id"] },
  { name: "bounty_threads", conflict: ["cast_hash"] },
  { name: "bot_log", conflict: ["id"] },
  { name: "processed_casts", conflict: ["cast_hash"] },
  { name: "wallet_balances", conflict: ["balance_key"] },
];

function quoteIdent(s) {
  return `"${s.replaceAll('"', '""')}"`;
}

async function ensureSchema() {
  for (const stmt of createStatements) {
    await target.unsafe(stmt);
  }
}

async function copyTable(name, conflictCols) {
  const rows = await source.unsafe(`SELECT * FROM ${quoteIdent(name)}`);
  if (rows.length === 0) {
    return { table: name, count: 0 };
  }
  if (isDryRun) {
    return { table: name, count: rows.length };
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map(quoteIdent).join(", ");
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const conflict = conflictCols.map(quoteIdent).join(", ");
  const mutableCols = cols.filter((c) => !conflictCols.includes(c));
  const updateSet = mutableCols.length
    ? mutableCols.map((c) => `${quoteIdent(c)} = EXCLUDED.${quoteIdent(c)}`).join(", ")
    : `${quoteIdent(conflictCols[0])} = EXCLUDED.${quoteIdent(conflictCols[0])}`;

  const query = `
    INSERT INTO ${quoteIdent(name)} (${colList})
    VALUES (${placeholders})
    ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}
  `;

  for (const row of rows) {
    const values = cols.map((c) => (row[c] === undefined ? null : row[c]));
    await target.unsafe(query, values);
  }

  return { table: name, count: rows.length };
}

async function main() {
  try {
    await source`select 1`;
    await target`select 1`;
    await ensureSchema();

    const results = [];
    for (const table of tables) {
      const out = await copyTable(table.name, table.conflict);
      results.push(out);
      console.log(`${table.name}: ${out.count} row(s)`);
    }

    const total = results.reduce((acc, r) => acc + r.count, 0);
    console.log(isDryRun ? `dry-run complete. total rows: ${total}` : `migration complete. total rows: ${total}`);
  } finally {
    await source.end({ timeout: 5 });
    await target.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Migration failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
