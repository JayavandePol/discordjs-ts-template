import { Client, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./config/config.js";
import { loadCommands } from "./core/command-registry.js";
import { registerEvents } from "./core/event-registry.js";
import { Command } from "./types/Command.js";
import { BotContext } from "./types/Context.js";
import { Logger } from "./utils/logger.js";
import { captureError } from "./utils/error-reporter.js";
import { initSequelize } from "./data/sequelize.js";
import { initErrorModel } from "./data/models/error-model.js";
import { ErrorStore } from "./data/error-store.js";

const config = loadConfig();
const logger = new Logger(config.logLevel);
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = await loadCommands(logger);

const sequelize = initSequelize(config, logger);
let errorStore: ErrorStore | undefined;

if (sequelize) {
  const errorModel = initErrorModel(sequelize);
  await sequelize.sync();
  errorStore = new ErrorStore(errorModel);
  logger.info("Database synced.");
}

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
