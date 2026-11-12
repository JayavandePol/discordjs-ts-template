import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  RESTPostAPIApplicationCommandsJSONBody,
  UserContextMenuCommandInteraction,
} from "discord.js";
import type { BotContext } from "./Context.js";

/**
 * Access levels, from least to most restricted:
 * - "public": anyone
 * - "admin": guild members with `permissions` (defaults to Administrator)
 * - "developer": users in DEV_USER_IDS or holding DEV_ROLE_ID; only registered in the dev guild
 */
export type AccessLevel = "public" | "admin" | "developer";

export type CommandKind = "slash" | "user" | "message";

// Anything with a name that serializes to an application command payload (all discord.js builders)
export type CommandData = {
  readonly name: string;
  toJSON(): RESTPostAPIApplicationCommandsJSONBody;
};

type CommandBase = {
  data: CommandData;

  // Access level; the folder a command lives in sets the minimum (see core/access.ts)
  access?: AccessLevel;

  // Permissions required for "admin" commands. Sent to Discord as default_member_permissions
  // and checked again at runtime. Defaults to PermissionFlagsBits.Administrator.
  permissions?: bigint;

  // Per-user cooldown in seconds
  cooldown?: number;

  // Defer the reply before execute(): true (public) or "ephemeral"
  defer?: boolean | "ephemeral";
};

export type SlashCommand = CommandBase & {
  kind: "slash";
  execute: (interaction: ChatInputCommandInteraction, context: BotContext) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction, context: BotContext) => Promise<void>;
};

export type UserCommand = CommandBase & {
  kind: "user";
  execute: (interaction: UserContextMenuCommandInteraction, context: BotContext) => Promise<void>;
};

export type MessageCommand = CommandBase & {
  kind: "message";
  execute: (interaction: MessageContextMenuCommandInteraction, context: BotContext) => Promise<void>;
};

export type Command = SlashCommand | UserCommand | MessageCommand;

/** Defines a slash command (`/name`). */
export const defineSlashCommand = (command: Omit<SlashCommand, "kind">): SlashCommand => ({
  ...command,
  kind: "slash",
});

/** Defines a user context menu command (right-click a user -> Apps). */
export const defineUserCommand = (command: Omit<UserCommand, "kind">): UserCommand => ({
  ...command,
  kind: "user",
});

/** Defines a message context menu command (right-click a message -> Apps). */
export const defineMessageCommand = (command: Omit<MessageCommand, "kind">): MessageCommand => ({
  ...command,
  kind: "message",
});

/** Registry key: names only have to be unique per command kind in Discord. */
export const commandKey = (kind: CommandKind, name: string) => `${kind}:${name}`;
