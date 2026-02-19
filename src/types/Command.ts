import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { BotContext } from "./Context.js";

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, context: BotContext) => Promise<void>;
  /**
   * Access controls applied by loader:
   * - "public": available to everyone (default)
   * - "admin": requires Administrator permission in the guild
   * - "developer": requires DEV_ID match
   */
  access?: "public" | "admin" | "developer";
  devOnly?: boolean;
}
