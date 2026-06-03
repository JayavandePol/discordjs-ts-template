import { Client, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./config/config.js";
import { loadCommands } from "./core/command-registry.js";
import { registerEvents } from "./core/event-registry.js";
import { Command } from "./types/Command.js";
import { BotContext } from "./types/Context.js";
import { Logger } from "./utils/logger.js";
import { captureError } from "./utils/error-reporter.js";
import { initPrisma } from "./data/prisma.js";
import { ErrorStore } from "./data/error-store.js";

const config = loadConfig();
const logger = new Logger(config.logLevel);
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = await loadCommands(logger);

const prisma = initPrisma(config, logger);
let errorStore: ErrorStore | undefined;

if (prisma) {
  await prisma.$connect();
  errorStore = new ErrorStore(prisma);
  logger.info("Database connected.");
}

let shuttingDown = false;
const shutdown = async (reason: string, error?: unknown) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn("Shutting down", { reason });
  if (error) {
    logger.error("Shutdown triggered by error", { error });
  }

  try {
    await client.destroy();
  } catch (closeError) {
    logger.error("Failed to close Discord client", { error: closeError });
  }

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

const context: BotContext = {
  client,
  logger,
  config,
  commands,
  errorStore,
};

await registerEvents(client, context, logger);

try {
  await client.login(config.token);
} catch (error) {
  const report = await captureError(logger, error, "login", errorStore);
  throw new Error(report.userMessage);
}
