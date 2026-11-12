import { Client, Events, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./config/config.js";
import { loadCommands } from "./core/command-registry.js";
import { ComponentRegistry } from "./core/component-registry.js";
import { registerEvents } from "./core/event-registry.js";
import { BotContext } from "./types/Context.js";
import { Logger } from "./utils/logger.js";
import { captureError } from "./utils/error-reporter.js";
import { initDatabase, DatabaseConnection } from "./data/db.js";
import { ErrorStore } from "./data/error-store.js";
import { CooldownManager } from "./utils/cooldown-manager.js";

// 1. Load and validate environment variables with Zod
const config = loadConfig();

// 2. Structured logging (pino, stdout)
const logger = new Logger(config.logLevel);

// 3. Discord client with the gateway intents the bot needs
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Client-level problems are logged, never fatal. Without an "error" listener, discord.js turns
// any rejected listener into an uncaught exception.
client.on(Events.Error, (error) => logger.error("Discord client error", error));
client.on(Events.Warn, (message) => logger.warn("Discord client warning", { message }));
client.on(Events.ShardError, (error, shardId) => logger.error("Discord shard error", { shardId, err: error }));

// 4. Commands, components and the database
const commands = await loadCommands(logger);
const components = new ComponentRegistry(logger);
await components.loadAll();

const dbConnection: DatabaseConnection | null = await initDatabase(config, logger);
const errorStore = dbConnection ? new ErrorStore(dbConnection) : undefined;
if (dbConnection) {
  logger.info(`Database connected successfully using ${dbConnection.dialect.toUpperCase()}.`);
}

const cooldowns = new CooldownManager();

// 5. Shutdown and process-level error policy
let shuttingDown = false;
const shutdown = async (reason: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn("Shutting down", { reason });

  try {
    await client.destroy();
  } catch (error) {
    logger.error("Failed to close Discord client", error);
  }

  if (dbConnection) {
    try {
      await dbConnection.close();
      logger.info("Database connection closed.");
    } catch (error) {
      logger.error("Failed to close database connection", error);
    }
  }

  await logger.flush();
  process.exit(exitCode);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

// A stray rejected promise is a bug worth reporting, but not worth dropping every user's session.
process.on("unhandledRejection", (reason) => {
  void captureError(logger, reason, "unhandledRejection", errorStore);
});

// After an uncaught exception the process state is unknown: log, flush and exit so the
// supervisor (Docker, systemd, PM2) restarts a clean process.
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", error);
  void shutdown("uncaughtException", 1);
});

// 6. Shared context for commands, components and events
const context: BotContext = {
  client,
  logger,
  config,
  commands,
  components,
  cooldowns,
  errorStore,
};

await registerEvents(client, context, logger);

// 7. Log in
try {
  await client.login(config.token);
} catch (error) {
  logger.error("Failed to log in to Discord. Check DISCORD_TOKEN and the enabled gateway intents.", error);
  await shutdown("login failed", 1);
}
