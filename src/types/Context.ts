import type { Client } from "discord.js";
import type { Config } from "../config/config.js";
import type { Logger } from "../utils/logger.js";
import type { Command } from "./Command.js";
import type { ErrorStore } from "../data/error-store.js";
import type { CooldownManager } from "../utils/cooldown-manager.js";
import type { ComponentRegistry } from "../core/component-registry.js";

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
