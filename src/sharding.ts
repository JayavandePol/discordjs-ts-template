import { ShardingManager } from "discord.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config/config.js";
import { Logger } from "./utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const logger = new Logger(config.logLevel);

const manager = new ShardingManager(path.join(__dirname, "index.js"), {
  token: config.token,
  totalShards: "auto", // Automatically calculate needed shards
});

manager.on("shardCreate", (shard) => {
  logger.info(`Launched shard ${shard.id}`);
});

manager.spawn().catch((error) => {
  logger.error("Failed to spawn shards", error);
});
