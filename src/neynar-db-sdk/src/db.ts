/* eslint-disable @neynar/no-process-env */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * Database Connection and Client
 *
 * This module sets up the PostgreSQL connection and Drizzle ORM client.
 * The connection is cached globally in development to prevent connection pooling issues.
 *
 * Note: process.env usage is allowed here for DATABASE_URL
 */

declare global {
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined;
  var __dbConnection: postgres.Sql | undefined;
}

let db: ReturnType<typeof drizzle<typeof schema>>;
let connection: postgres.Sql;

if (process.env.DATABASE_URL) {
  if (process.env.NODE_ENV === "production") {
    // Production: Create new connection
    connection = postgres(process.env.DATABASE_URL);
    db = drizzle(connection, { schema });
  } else {
    // Development: Reuse connection to avoid hot reload issues
    if (!globalThis.__dbConnection) {
      globalThis.__dbConnection = postgres(process.env.DATABASE_URL);
      globalThis.__db = drizzle(globalThis.__dbConnection, { schema });
    }
    connection = globalThis.__dbConnection;
    db = globalThis.__db as ReturnType<typeof drizzle<typeof schema>>;
  }
} else {
  // No DATABASE_URL - create stub that throws helpful error
  const createStub = () => {
    throw new Error(
      "DATABASE_URL environment variable is not set. Database operations are unavailable.",
    );
  };

  connection = createStub as unknown as postgres.Sql;
  db = createStub as unknown as ReturnType<typeof drizzle<typeof schema>>;
}

export { db, connection };
