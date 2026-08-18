import fs from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";

// Ensures directory exists on disk before initializing SQLite file
const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Constructs a valid SQLite file URL from a relative/absolute disk path
const buildSqliteUrl = (storage: string): string => {
  const absolutePath = path.resolve(storage);
  ensureDir(absolutePath);
  return `file:${absolutePath.replace(/\\/g, "/")}`;
};

/**
 * Initializes and returns a PrismaClient instance based on environment configuration.
 * Returns null if database is disabled.
 */
export const initPrisma = (config: Config, logger: Logger): PrismaClient | null => {
  if (!config.database.enabled) {
    logger.info("Database disabled; error records and persistent state will not be stored.");
    return null;
  }

  // Resolve datasource URL (from DATABASE_URL or SQLite file path)
  const datasourceUrl =
    config.database.url ?? buildSqliteUrl(config.database.storage ?? "./data/database.sqlite");

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log: config.database.logging ? ["query", "info", "warn", "error"] : ["warn", "error"],
  });

  // Attach query listener if DB_LOGGING=true
  if (config.database.logging) {
    prisma.$on("query", (event: Prisma.QueryEvent) => {
      logger.debug("prisma:query", {
        query: event.query,
        params: event.params,
        duration: event.duration,
      });
    });
  }

  return prisma;
};
