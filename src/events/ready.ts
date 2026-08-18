import { Events } from "discord.js";
import { Event } from "../types/Event.js";
import { registerApplicationCommands } from "../core/command-publisher.js";
import { captureError } from "../utils/error-reporter.js";

// ClientReady event handler triggered once the Discord bot successfully establishes a gateway connection
const event: Event<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,
  async execute(client, context) {
    const { logger, config, commands } = context;

    // Log successful authentication and bot tag
    logger.info(`Ready! Logged in as ${client.user?.tag} (${client.user?.id})`);

    // Guard command registration: Discord rate limits global/guild command PUT endpoints (200 requests/day).
    // In local development with file watchers (like tsx watch / nodemon), deploying on every restart will quickly
    // exhaust the daily rate limit quota. Use `npm run register:guild` or set AUTO_REGISTER_COMMANDS=true.
    if (config.autoRegisterCommands) {
      try {
        logger.info("AUTO_REGISTER_COMMANDS is true; publishing application commands to Discord...");
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
    } else {
      logger.info(
        "Auto command registration on startup is disabled. Use 'npm run register:guild' or 'npm run register:global' to deploy changes."
      );
    }
  },
};

export default event;
