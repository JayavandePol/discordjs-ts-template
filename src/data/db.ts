import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle as drizzleSqlite, LibSQLDatabase } from "drizzle-orm/libsql";
import postgres from "postgres";
import { drizzle as drizzlePg, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import mysql from "mysql2/promise";
import { drizzle as drizzleMysql, MySql2Database } from "drizzle-orm/mysql2";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import * as sqliteSchema from "./schema/sqlite.js";
import * as pgSchema from "./schema/pg.js";
import * as mysqlSchema from "./schema/mysql.js";

// Supported SQL Dialects
export type DatabaseDialect = "sqlite" | "postgres" | "mysql";

// Unified wrapper holding the active Drizzle database client and dialect
export type DatabaseConnection = {
  dialect: DatabaseDialect;
  sqlite?: LibSQLDatabase<typeof sqliteSchema>;
  pg?: PostgresJsDatabase<typeof pgSchema>;
  mysql?: MySql2Database<typeof mysqlSchema>;
  close: () => Promise<void> | void;
};

// Ensures parent directories exist on disk for SQLite files
const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

/**
 * Automatically inspects the configured connection URL or defaults to resolve the database dialect.
 */
export const detectDialect = (config: Config): DatabaseDialect => {
  const url = config.database.url?.toLowerCase().trim();
  if (!url) return "sqlite";

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }

  if (url.startsWith("mysql://") || url.startsWith("mariadb://")) {
    return "mysql";
  }

  return "sqlite";
};

/**
 * Initializes a multi-dialect Drizzle ORM connection based on environment configuration.
 *
 * - SQLite (Default): Runs locally with `@libsql/client` (zero server config, no build tools required).
 * - PostgreSQL: Automatically boots when DATABASE_URL is `postgres://` or `postgresql://`.
 * - MySQL/MariaDB: Automatically boots when DATABASE_URL is `mysql://` or `mariadb://`.
 */
export const initDatabase = async (
  config: Config,
  logger: Logger
): Promise<DatabaseConnection | null> => {
  if (!config.database.enabled) {
    logger.info("Database is disabled in configuration; persistent storage will be skipped.");
    return null;
  }

  const dialect = detectDialect(config);
  logger.info(`Initializing Drizzle ORM with dialect: ${dialect.toUpperCase()}`);

  if (dialect === "postgres") {
    // Connect to PostgreSQL / Supabase / Neon
    const client = postgres(config.database.url!);
    const db = drizzlePg(client, { schema: pgSchema });

    return {
      dialect: "postgres",
      pg: db,
      close: async () => {
        await client.end();
      },
    };
  }

  if (dialect === "mysql") {
    // Connect to MySQL / MariaDB / PlanetScale
    const pool = mysql.createPool(config.database.url!);
    const db = drizzleMysql(pool, { schema: mysqlSchema, mode: "default" });

    return {
      dialect: "mysql",
      mysql: db,
      close: async () => {
        await pool.end();
      },
    };
  }

  // Default: SQLite, via libSQL (ships prebuilt native bindings for every platform,
  // so forking this template never requires a local C++ toolchain to run `npm install`).
  const sqlitePath = config.database.url
    ? config.database.url.replace(/^file:/, "")
    : config.database.storage;

  const resolvedPath = path.resolve(sqlitePath);
  ensureDir(resolvedPath);

  const client = createClient({ url: `file:${resolvedPath}` });
  // Enable Write-Ahead Logging (WAL) for superior concurrency and performance in SQLite
  await client.execute("PRAGMA journal_mode = WAL;");

  const db = drizzleSqlite(client, { schema: sqliteSchema });

  // Automatically create the errors table if it does not yet exist in SQLite
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
    sqlite: db,
    close: () => {
      client.close();
    },
  };
};
