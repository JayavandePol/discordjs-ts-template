import { REST, Routes } from "discord.js";
import { Command } from "../types/Command.js";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";

// Deployment scope for application commands
export type RegistrationScope = "global" | "guild";

// Resolves target deployment scope based on CLI override, multiGuild flag, and presence of GUILD_ID
const resolveScope = (config: Config, override?: RegistrationScope): RegistrationScope => {
  if (override) return override;
  if (config.multiGuild) return "global";
  return config.guildId ? "guild" : "global";
};

/**
 * Publishes in-memory slash commands to Discord's REST API endpoint.
 *
 * Guild commands deploy instantly for testing in the specified GUILD_ID.
 * Global commands deploy across all guilds where the bot is installed.
 */
export const registerApplicationCommands = async (
  commands: Map<string, Command>,
  config: Config,
  logger: Logger,
  overrideScope?: RegistrationScope
): Promise<void> => {
  const scope = resolveScope(config, overrideScope);
  if (scope === "guild" && !config.guildId) {
    throw new Error("GUILD_ID is required when registering guild commands.");
  }

  // Initialize Discord REST client using bot token
  const rest = new REST({ version: "10" }).setToken(config.token);
  const payload = [...commands.values()].map((command) => command.data.toJSON());

  logger.info(`Registering ${payload.length} application commands (scope: ${scope})...`);

  if (scope === "guild") {
    // Deploy specifically to development guild (updates immediately)
    await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId!), {
      body: payload,
    });
  } else {
    // Deploy globally across Discord (may take up to 1 hour to propagate on all clients)
    await rest.put(Routes.applicationCommands(config.applicationId), { body: payload });
  }

  logger.info(`Commands registered successfully (${scope}).`);
};
