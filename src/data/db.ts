import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Logger as DrizzleLogger } from "drizzle-orm/logger";
import type { Config } from "../config/config.js";
import type { Logger } from "../utils/logger.js";
import type { DatabaseDialect } from "./database-url.js";
import * as sqliteSchema from "./schema/sqlite.js";
import * as pgSchema from "./schema/pg.js";

export type { DatabaseDialect } from "./database-url.js";

// drizzle/sqlite and drizzle/pg, from both src/data and dist/data
const MIGRATIONS_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export type DatabaseConnection =
  | { dialect: "sqlite"; db: LibSQLDatabase<typeof sqliteSchema>; close: () => Promise<void> }
  | { dialect: "postgres"; db: PostgresJsDatabase<typeof pgSchema>; close: () => Promise<void> };

// DB_LOGGING=true logs each query at debug level (parameters are left out: they can hold user data)
const queryLogger = (logger: Logger): DrizzleLogger => ({
  logQuery: (query, params) => logger.debug("Database query", { query, params: params.length }),
});

/**
 * Connects to the database from DATABASE_URL, checks it answers and applies pending migrations.
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

  // Bring the schema up to date before the bot starts handling interactions
  try {
    await runMigrations(connection);
  } catch (error) {
    await connection.close().catch(() => undefined);
    throw new Error(`Database migration failed: ${(error as Error).message}`, { cause: error });
  }
  logger.info("Database migrations are up to date.");

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

  return {
    dialect: "sqlite",
    db: drizzle(client, { schema: sqliteSchema, logger }),
    close: async () => client.close(),
  };
};

const runMigrations = async (connection: DatabaseConnection) => {
  if (connection.dialect === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(connection.db, { migrationsFolder: path.join(MIGRATIONS_ROOT, "pg") });
  } else {
    const { migrate } = await import("drizzle-orm/libsql/migrator");
    await migrate(connection.db, { migrationsFolder: path.join(MIGRATIONS_ROOT, "sqlite") });
  }
};

export const describeDatabase = (dialect: DatabaseDialect) => (dialect === "postgres" ? "PostgreSQL" : "SQLite");
