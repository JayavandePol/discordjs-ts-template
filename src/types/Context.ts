import { Client } from "discord.js";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import { Command } from "./Command.js";
import { ErrorStore } from "../data/error-store.js";
import { CooldownManager } from "../utils/cooldown-manager.js";
import { ComponentRegistry } from "../core/component-registry.js";

/**
 * Shared bot runtime context passed to all command and event executions.
 */
export interface BotContext {
  // Active Discord client instance
  client: Client;

  // Structured logger instance
  logger: Logger;

  // Validated application configuration
  config: Config;

  // In-memory collection of all loaded slash & context menu commands
  commands: Map<string, Command>;

  // Registry of modular button, select menu, and modal component handlers
  components: ComponentRegistry;

  // Cooldown tracker for rate-limiting command usage
  cooldowns: CooldownManager;

  // Optional database store for logging and retrieving persistent error records
  errorStore?: ErrorStore;
}
