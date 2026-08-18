import { Client, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./config/config.js";
import { loadCommands } from "./core/command-registry.js";
import { registerEvents } from "./core/event-registry.js";
import { BotContext } from "./types/Context.js";
import { Logger } from "./utils/logger.js";
import { captureError } from "./utils/error-reporter.js";
import { initPrisma } from "./data/prisma.js";
import { ErrorStore } from "./data/error-store.js";
import { CooldownManager } from "./utils/cooldown-manager.js";

// 1. Load and validate environment variables with Zod
const config = loadConfig();

// 2. Initialize structured logging system with configured verbosity
const logger = new Logger(config.logLevel);

// 3. Initialize Discord client with required gateway intents
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 4. Load all command files from src/commands recursively
const commands = await loadCommands(logger);

// 5. Initialize optional database connection via Prisma
const prisma = initPrisma(config, logger);
let errorStore: ErrorStore | undefined;

if (prisma) {
  await prisma.$connect();
  errorStore = new ErrorStore(prisma);
  logger.info("Database connected.");
}

// 6. Initialize in-memory cooldown tracking manager
const cooldowns = new CooldownManager();

// 7. Handle graceful shutdown for process signals and uncaught exceptions
let shuttingDown = false;
const shutdown = async (reason: string, error?: unknown) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn("Shutting down", { reason });
  if (error) {
    logger.error("Shutdown triggered by error", { error });
  }

  // Destroy Discord gateway connection gracefully
  try {
    await client.destroy();
  } catch (closeError) {
    logger.error("Failed to close Discord client", { error: closeError });
  }

  // Disconnect database client gracefully
  if (prisma) {
    try {
      await prisma.$disconnect();
    } catch (closeError) {
      logger.error("Failed to disconnect Prisma", { error: closeError });
    }
  }

  process.exit(error ? 1 : 0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => shutdown("uncaughtException", error));
process.on("unhandledRejection", (error) => shutdown("unhandledRejection", error));

// 8. Assemble the shared context object
const context: BotContext = {
  client,
  logger,
  config,
  commands,
  cooldowns,
  errorStore,
};

// 9. Load and attach all event listeners from src/events
await registerEvents(client, context, logger);

// 10. Authenticate and log in to Discord gateway
try {
  await client.login(config.token);
} catch (error) {
  const report = await captureError(logger, error, "login", errorStore);
  throw new Error(report.userMessage);
}
