import { ShardingManager } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config/config.js";
import { Logger } from "./utils/logger.js";

// Load configuration and logger for the sharding master process
const config = loadConfig();
const logger = new Logger(config.logLevel);

// Resolve current directory path in ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detect if running against TypeScript source files or compiled JavaScript output
const tsEntryPoint = path.join(__dirname, "index.ts");
const jsEntryPoint = path.join(__dirname, "index.js");
const entryPoint = fs.existsSync(tsEntryPoint) ? tsEntryPoint : jsEntryPoint;

// Initialize ShardingManager for high-scale multi-process bot execution (1000+ servers)
const manager = new ShardingManager(entryPoint, {
  token: config.token,
  totalShards: "auto", // Automatically determines required shard count via Discord gateway API
  execArgv: entryPoint.endsWith(".ts") ? ["--import", "tsx"] : [],
});

// Event listener fired whenever a new child shard process is spawned
manager.on("shardCreate", (shard) => {
  logger.info(`Launched Shard #${shard.id}`);
});

// Spawn all allocated shard processes
manager.spawn().catch((error) => {
  logger.error("Failed to spawn shards", error);
});
