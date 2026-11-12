import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Logger as DrizzleLogger } from "drizzle-orm/logger";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import type { DatabaseDialect } from "./database-url.js";
import * as sqliteSchema from "./schema/sqlite.js";
import * as pgSchema from "./schema/pg.js";

export type { DatabaseDialect } from "./database-url.js";

export type DatabaseConnection =
  | { dialect: "sqlite"; db: LibSQLDatabase<typeof sqliteSchema>; close: () => Promise<void> }
  | { dialect: "postgres"; db: PostgresJsDatabase<typeof pgSchema>; close: () => Promise<void> };

// DB_LOGGING=true logs each query at debug level (parameters are left out: they can hold user data)
const queryLogger = (logger: Logger): DrizzleLogger => ({
  logQuery: (query, params) => logger.debug("Database query", { query, params: params.length }),
});

/**
 * Connects to the database from DATABASE_URL and checks it answers before returning.
 * Drivers are imported on demand, so an unused driver is never loaded.
 */
export const initDatabase = async (config: Config, logger: Logger): Promise<DatabaseConnection | null> => {
  if (!config.database.enabled) {
    logger.info("Database is disabled (DB_ENABLED=false); error reports will only be logged.");
    return null;
  }

  const { target } = config.database;
  const drizzleLogger = config.database.logging ? queryLogger(logger) : undefined;
  logger.info(`Connecting to ${target.dialect === "postgres" ? "PostgreSQL" : "SQLite"}...`);

  const connection = target.dialect === "postgres"
    ? await connectPostgres(target.url, drizzleLogger)
    : await connectSqlite(target, config.database.authToken, drizzleLogger);

  try {
    if (connection.dialect === "sqlite") await connection.db.run(sql`select 1`);
    else await connection.db.execute(sql`select 1`);
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw new Error(`Could not reach the database: ${(error as Error).message}`, { cause: error });
  }

  return connection;
};

const connectPostgres = async (url: string, logger?: DrizzleLogger): Promise<DatabaseConnection> => {
  const { default: postgres } = await import("postgres");
  const { drizzle } = await import("drizzle-orm/postgres-js");

  const client = postgres(url, { max: 10, onnotice: () => undefined });
  return {
    dialect: "postgres",
    db: drizzle(client, { schema: pgSchema, logger }),
    close: () => client.end({ timeout: 5 }),
  };
};

const connectSqlite = async (
  target: { url: string; filePath?: string },
  authToken: string | undefined,
  logger?: DrizzleLogger
): Promise<DatabaseConnection> => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");

  if (target.filePath) fs.mkdirSync(path.dirname(target.filePath), { recursive: true });

  const client = createClient({ url: target.url, authToken });
  // Write-ahead logging lets reads continue while a write is in progress (local files only)
  if (target.filePath) await client.execute("PRAGMA journal_mode = WAL;");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS errors (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'error',
      context TEXT NOT NULL,
      name TEXT,
      message TEXT NOT NULL,
      stack TEXT,
      guild_id TEXT,
      user_id TEXT,
      command TEXT,
      meta TEXT,
      occurrences INTEGER NOT NULL DEFAULT 1
    );
  `);

  return {
    dialect: "sqlite",
    db: drizzle(client, { schema: sqliteSchema, logger }),
    close: async () => client.close(),
  };
};

export const describeDatabase = (dialect: DatabaseDialect) => (dialect === "postgres" ? "PostgreSQL" : "SQLite");
