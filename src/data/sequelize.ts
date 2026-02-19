import fs from "node:fs";
import path from "node:path";
import { Sequelize, Dialect, Options } from "sequelize";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";

const ensureDir = (filePath: string) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const resolveDialect = (configValue?: string): Dialect => {
  const normalized = (configValue ?? "sqlite").toLowerCase();
  const allowed: Dialect[] = ["mysql", "postgres", "sqlite", "mariadb", "mssql"];
  if (allowed.includes(normalized as Dialect)) return normalized as Dialect;
  return "sqlite";
};

export const initSequelize = (config: Config, logger: Logger): Sequelize | null => {
  if (!config.database.enabled) {
    logger.info("Database disabled; error records will not be persisted.");
    return null;
  }

  const dialect = resolveDialect(config.database.dialect);
  const logging = config.database.logging ? (msg: string) => logger.debug(msg) : false;

  const common: Options = { dialect, logging };

  if (config.database.url) {
    return new Sequelize(config.database.url, common);
  }

  if (dialect === "sqlite") {
    const storage = config.database.storage ?? "./data/database.sqlite";
    ensureDir(storage);
    return new Sequelize({
      ...common,
      storage,
    });
  }

  return new Sequelize(
    config.database.database ?? "",
    config.database.username ?? "",
    config.database.password ?? "",
    {
      ...common,
      host: config.database.host,
      port: config.database.port,
    }
  );
};
