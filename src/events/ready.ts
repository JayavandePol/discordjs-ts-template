import { Events } from "discord.js";
import { Event } from "../types/Event.js";
import { registerApplicationCommands } from "../core/command-publisher.js";
import { captureError } from "../utils/error-reporter.js";

const event: Event<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  async execute(client, context) {
    const { logger, config, commands } = context;
    logger.info(`Ready! Logged in as ${client.user?.tag}`);
    try {
      await registerApplicationCommands(commands, config, logger);
    } catch (error) {
      const report = await captureError(
        logger,
        error,
        "register-commands-on-ready",
        context.errorStore
      );
      logger.error(report.userMessage);
    }
  },
};

export default event;
