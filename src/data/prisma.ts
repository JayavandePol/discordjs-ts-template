import fs from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";

const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const buildSqliteUrl = (storage: string): string => {
  const absolutePath = path.resolve(storage);
  ensureDir(absolutePath);
  return `file:${absolutePath.replace(/\\/g, "/")}`;
};

export const initPrisma = (config: Config, logger: Logger): PrismaClient | null => {
  if (!config.database.enabled) {
    logger.info("Database disabled; error records will not be persisted.");
    return null;
  }

  const datasourceUrl = config.database.url ?? buildSqliteUrl(config.database.storage ?? "./data/database.sqlite");
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: datasourceUrl,
      },
    },
    log: config.database.logging ? ["query", "info", "warn", "error"] : ["warn", "error"],
  });

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
