import {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
} from "discord.js";
import { BotContext } from "./Context.js";

// Builder union type covering standard slash command builders
export type CommandBuilder =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder
  | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

/**
 * Interface representing a slash command module in the bot framework.
 */
export interface Command {
  // Slash command builder data (name, description, options, subcommands)
  data: CommandBuilder;

  // Primary execution handler invoked when a user runs the slash command
  execute: (interaction: ChatInputCommandInteraction, context: BotContext) => Promise<void>;

  // Optional handler for dynamic option autocompletion
  autocomplete?: (interaction: AutocompleteInteraction, context: BotContext) => Promise<void>;

  /**
   * Access level applied automatically based on folder or explicit declaration:
   * - "public": Available to all users (default)
   * - "admin": Requires Administrator permission in the guild
   * - "developer": Requires user ID in DEV_USER_IDS or DEV_ROLE_ID role match
   */
  access?: "public" | "admin" | "developer";

  // Shortcut flag for developer-only access
  devOnly?: boolean;

  // Cooldown duration in seconds before the same user can run the command again
  cooldown?: number;

  /**
   * Automatic interaction deferral helper:
   * - true: calls `interaction.deferReply()` automatically before execute
   * - "ephemeral": calls `interaction.deferReply({ ephemeral: true })` before execute
   */
  defer?: boolean | "ephemeral";
}
