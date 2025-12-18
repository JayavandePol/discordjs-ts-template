import { REST, Routes } from "discord.js";
import { Command } from "../types/Command.js";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";

export type RegistrationScope = "global" | "guild";

const resolveScope = (config: Config, override?: RegistrationScope): RegistrationScope => {
  if (override) return override;
  if (config.multiGuild) return "global";
  return config.guildId ? "guild" : "global";
};

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

  const rest = new REST({ version: "10" }).setToken(config.token);
  const payload = [...commands.values()].map((command) => command.data.toJSON());

  logger.info(`Registering ${payload.length} commands (${scope})`);

  if (scope === "guild") {
    await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId!), {
      body: payload,
    });
  } else {
    await rest.put(Routes.applicationCommands(config.applicationId), { body: payload });
  }

  logger.info("Commands registered successfully.");
};
