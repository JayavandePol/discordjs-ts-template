import {
  Events,
  Interaction,
  PermissionsBitField,
  GuildMember,
} from "discord.js";
import { Event } from "../types/Event.js";
import { Config } from "../config/config.js";
import { ExecutableInteraction } from "../types/Command.js";
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
const event: Event<Events.InteractionCreate> = {
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
      const command = commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

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
      const command = commands.get(interaction.commandName);
      if (!command) {
        logger.warn("Received unknown command", { command: interaction.commandName });
        await interaction.reply({ content: "Command not recognized.", ephemeral: true });
        return;
      }

      // Access Check: Developer-Only commands
      if (command.access === "developer" || command.devOnly) {
        const member = interaction.inCachedGuild() ? interaction.member : null;
        const authorized = isDeveloper(interaction.user.id, member, config);

        if (!authorized) {
          logger.warn("Unauthorized developer command attempt", {
            user: interaction.user.id,
            command: command.data.name,
          });
          await interaction.reply({
            content: "This command is restricted to the bot developer.",
            ephemeral: true,
          });
          return;
        }
      }

      // Access Check: Administrator-Only commands
      if (command.access === "admin") {
        if (!interaction.inCachedGuild()) {
          await interaction.reply({
            content: "Admin commands can only be used inside a server.",
            ephemeral: true,
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
            ephemeral: true,
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
            ephemeral: true,
          });
          return;
        }
      }

      // Automatic reply deferral helper (prevents 3s interaction timeouts)
      if (command.defer) {
        const ephemeral = command.defer === "ephemeral";
        await interaction.deferReply({ ephemeral });
      }

      // Command execution with central error capture
      try {
        await (command.execute as (interaction: ExecutableInteraction, context: any) => Promise<void>)(
          interaction,
          context
        );
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
};

export default event;
