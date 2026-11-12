import {
  MessageFlags,
  Events,
  Interaction,
  PermissionsBitField,
  GuildMember,
} from "discord.js";
import { defineEvent } from "../types/Event.js";
import { Config } from "../config/config.js";
import { commandKey } from "../types/Command.js";
import { handleInteractionError } from "../utils/error-handler.js";

/**
 * Checks if an interaction user has developer privileges based on:
 * 1. Matching a User ID in `config.devUserIds` (works in Guilds and DMs)
 * 2. Or possessing a configured developer Role ID within the current guild
 */
const isDeveloper = (
  userId: string,
  member: GuildMember | null,
  config: Config
): boolean => {
  // Check direct user snowflake match
  if (config.devUserIds.includes(userId)) {
    return true;
  }

  // Check role match if member cache is available in guild
  if (config.devRoleId && member && member.roles.cache.has(config.devRoleId)) {
    return true;
  }

  return false;
};

// Main interaction router handling Slash Commands, Context Menus, Autocomplete, Buttons, Select Menus, and Modals
const event = defineEvent({
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, context) {
    const { commands, components, logger, config, cooldowns } = context;

    // ------------------------------------------------------------------
    // 1. Button Interactions (Routed via ComponentRegistry)
    // ------------------------------------------------------------------
    if (interaction.isButton()) {
      const handler = components.findButton(interaction.customId);
      if (handler) {
        try {
          await handler.execute(interaction, context);
        } catch (error) {
          await handleInteractionError(
            interaction,
            context,
            error,
            `button:${interaction.customId}`
          );
        }
      }
      return;
    }

    // ------------------------------------------------------------------
    // 2. Select Menu Interactions (String, User, Role, Channel, Mentionable)
    // ------------------------------------------------------------------
    if (interaction.isAnySelectMenu()) {
      const handler = components.findSelectMenu(interaction.customId);
      if (handler) {
        try {
          await handler.execute(interaction, context);
        } catch (error) {
          await handleInteractionError(
            interaction,
            context,
            error,
            `selectMenu:${interaction.customId}`
          );
        }
      }
      return;
    }

    // ------------------------------------------------------------------
    // 3. Modal Submission Interactions
    // ------------------------------------------------------------------
    if (interaction.isModalSubmit()) {
      const handler = components.findModal(interaction.customId);
      if (handler) {
        try {
          await handler.execute(interaction, context);
        } catch (error) {
          await handleInteractionError(
            interaction,
            context,
            error,
            `modal:${interaction.customId}`
          );
        }
      }
      return;
    }

    // ------------------------------------------------------------------
    // 4. Autocomplete Interactions
    // ------------------------------------------------------------------
    if (interaction.isAutocomplete()) {
      const command = commands.get(commandKey("slash", interaction.commandName));
      if (command?.kind !== "slash" || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction, context);
      } catch (error) {
        logger.error("Autocomplete handler error", {
          command: interaction.commandName,
          error,
        });
      }
      return;
    }

    // ------------------------------------------------------------------
    // 5. Application Commands (Slash Commands & Context Menus)
    // ------------------------------------------------------------------
    if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
      const kind = interaction.isChatInputCommand() ? "slash" : interaction.isUserContextMenuCommand() ? "user" : "message";
      const command = commands.get(commandKey(kind, interaction.commandName));
      if (!command) {
        logger.warn("Received unknown command", { command: interaction.commandName });
        await interaction.reply({ content: "Command not recognized.", flags: MessageFlags.Ephemeral });
        return;
      }

      // Access Check: Developer-Only commands
      if (command.access === "developer") {
        const member = interaction.inCachedGuild() ? interaction.member : null;
        const authorized = isDeveloper(interaction.user.id, member, config);

        if (!authorized) {
          logger.warn("Unauthorized developer command attempt", {
            user: interaction.user.id,
            command: command.data.name,
          });
          await interaction.reply({
            content: "This command is restricted to the bot developer.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // Access Check: Administrator-Only commands
      if (command.access === "admin") {
        if (!interaction.inCachedGuild()) {
          await interaction.reply({
            content: "Admin commands can only be used inside a server.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const hasAdmin = interaction.memberPermissions?.has(
          PermissionsBitField.Flags.Administrator
        );
        if (!hasAdmin) {
          logger.warn("Unauthorized admin command attempt", {
            user: interaction.user.id,
            command: command.data.name,
          });
          await interaction.reply({
            content: "You need Administrator permissions to use this command.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // Cooldown verification (rate-limiting)
      if (command.cooldown) {
        const remaining = cooldowns.check(
          command.data.name,
          interaction.user.id,
          command.cooldown
        );
        if (remaining !== null) {
          await interaction.reply({
            content: `⏳ Please wait **${remaining}s** before using the \`${command.data.name}\` command again.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      // Automatic reply deferral helper (prevents 3s interaction timeouts)
      if (command.defer) {
        await interaction.deferReply(command.defer === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {});
      }

      // Command execution with central error capture
      try {
        if (command.kind === "slash" && interaction.isChatInputCommand()) await command.execute(interaction, context);
        else if (command.kind === "user" && interaction.isUserContextMenuCommand()) await command.execute(interaction, context);
        else if (command.kind === "message" && interaction.isMessageContextMenuCommand()) await command.execute(interaction, context);
      } catch (error) {
        await handleInteractionError(
          interaction,
          context,
          error,
          `command:${interaction.commandName}`
        );
      }
    }
  },
});

export default event;
