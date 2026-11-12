import path from "node:path";

export type DatabaseDialect = "sqlite" | "postgres";

export type DatabaseTarget =
  | { dialect: "sqlite"; url: string; filePath?: string }
  | { dialect: "postgres"; url: string };

export const DEFAULT_SQLITE_PATH = "./data/database.sqlite";

/**
 * Turns DATABASE_URL into a connection target. Shared by the bot and drizzle.config.ts so both
 * always talk to the same database.
 *
 * - empty                      -> SQLite at ./data/database.sqlite
 * - ./path, /path, C:\path     -> SQLite file
 * - file:./path                -> SQLite file
 * - :memory:                   -> in-memory SQLite (tests)
 * - libsql://, http(s)://, ws(s):// -> remote libSQL / Turso (set DATABASE_AUTH_TOKEN)
 * - postgres://, postgresql:// -> PostgreSQL
 *
 * Anything else (mysql://, typos) throws instead of silently becoming a SQLite file.
 */
export const resolveDatabase = (rawUrl: string | undefined, cwd = process.cwd()): DatabaseTarget => {
  const url = rawUrl?.trim() || DEFAULT_SQLITE_PATH;

  if (url === ":memory:") return { dialect: "sqlite", url: ":memory:" };

  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(url)?.[1]?.toLowerCase();

  if (scheme === "postgres" || scheme === "postgresql") return { dialect: "postgres", url };
  if (scheme && ["libsql", "http", "https", "ws", "wss"].includes(scheme)) return { dialect: "sqlite", url };
  if (scheme === "mysql" || scheme === "mariadb") {
    throw new Error("MySQL/MariaDB is not supported. Use SQLite (default) or PostgreSQL.");
  }

  // file: URLs and plain paths (a Windows drive letter like C:\ is not a scheme)
  const isWindowsPath = /^[a-z]:[\\/]/i.test(url);
  if (scheme || (!isWindowsPath && /^[a-z][a-z0-9+.-]*:(?!\/\/)/i.test(url) && !url.startsWith("file:"))) {
    throw new Error(`Unsupported DATABASE_URL "${url}". Use a SQLite file path or a postgres:// URL.`);
  }

  const filePath = path.resolve(cwd, url.replace(/^file:(\/\/)?/, ""));
  return { dialect: "sqlite", url: `file:${filePath}`, filePath };
};
