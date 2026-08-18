import {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  SlashCommandOptionsOnlyBuilder,
  ContextMenuCommandBuilder,
} from "discord.js";
import { BotContext } from "./Context.js";

// Builder union type covering Slash commands and Context Menu commands
export type CommandBuilder =
  | SlashCommandBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | SlashCommandOptionsOnlyBuilder
  | ContextMenuCommandBuilder
  | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;

// Union of all interaction types that can execute a command
export type ExecutableInteraction =
  | ChatInputCommandInteraction
  | ContextMenuCommandInteraction
  | UserContextMenuCommandInteraction
  | MessageContextMenuCommandInteraction;

/**
 * Interface representing a slash command or context menu command module.
 * Defaults to `ChatInputCommandInteraction` for standard slash commands.
 */
export interface Command<T extends ExecutableInteraction = ChatInputCommandInteraction> {
  // Application command builder data (Slash or Context Menu)
  data: CommandBuilder;

  // Primary execution handler receiving the typed interaction and BotContext
  execute: (interaction: T, context: BotContext) => Promise<void>;

  // Optional handler for dynamic option autocompletion (Slash commands only)
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
