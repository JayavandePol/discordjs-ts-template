import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from "discord.js";
import { Command } from "../types/Command.js";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import { adminPermissions } from "./access.js";

export type RegistrationScope = "global" | "guild";

/** Scope used when nothing is passed explicitly (auto-registration on startup). */
export const defaultScope = (config: Config): RegistrationScope => {
  if (config.multiGuild) return "global";
  return config.guildId ? "guild" : "global";
};

/**
 * Serializes a command and sets default_member_permissions from its access level, so Discord
 * hides admin and developer commands from members who can't use them. The bot checks again
 * at runtime with the same permissions (core/access.ts).
 */
export const toPayload = (command: Command): RESTPostAPIApplicationCommandsJSONBody => {
  const json = command.data.toJSON();
  if (json.default_member_permissions != null) return json;

  if (command.access === "developer") return { ...json, default_member_permissions: "0" };
  if (command.access === "admin") return { ...json, default_member_permissions: adminPermissions(command).toString() };
  return json;
};

/**
 * Publishes commands to Discord.
 *
 * - "guild":  every command goes to GUILD_ID (updates instantly; for development).
 * - "global": public and admin commands go global; developer commands go only to GUILD_ID,
 *             so they never show up in other servers.
 *
 * Each PUT replaces the full command list for that scope.
 */
export const registerApplicationCommands = async (
  commands: Map<string, Command>,
  config: Config,
  logger: Logger,
  scope: RegistrationScope
): Promise<void> => {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const all = [...commands.values()];
  const developer = all.filter((command) => command.access === "developer");
  const shared = all.filter((command) => command.access !== "developer");

  if (scope === "guild") {
    if (!config.guildId) throw new Error("GUILD_ID is required to register guild commands.");
    logger.info(`Registering ${all.length} commands to guild ${config.guildId}...`);
    await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), {
      body: all.map(toPayload),
    });
    logger.info("Guild commands registered.");
    return;
  }

  logger.info(`Registering ${shared.length} global commands (can take a while to appear in clients)...`);
  await rest.put(Routes.applicationCommands(config.applicationId), { body: shared.map(toPayload) });

  if (developer.length === 0) return;
  if (!config.guildId) {
    logger.warn("GUILD_ID is not set; developer commands were not registered anywhere.", {
      commands: developer.map((command) => command.data.name),
    });
    return;
  }

  // Replaces the dev guild's list with only the developer commands, which also removes guild
  // copies of public commands left over from earlier `register:guild` runs (no duplicates).
  await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), {
    body: developer.map(toPayload),
  });
  logger.info(`Registered ${developer.length} developer commands to guild ${config.guildId}.`);
};

/** Removes every command in the given scope. */
export const clearApplicationCommands = async (
  config: Config,
  logger: Logger,
  scope: RegistrationScope
): Promise<void> => {
  const rest = new REST({ version: "10" }).setToken(config.token);
  if (scope === "guild") {
    if (!config.guildId) throw new Error("GUILD_ID is required to clear guild commands.");
    await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), { body: [] });
  } else {
    await rest.put(Routes.applicationCommands(config.applicationId), { body: [] });
  }
  logger.info(`Cleared all ${scope} commands.`);
};
