import {
  ButtonInteraction,
  Events,
  Interaction,
  PermissionsBitField,
  EmbedBuilder,
  GuildMember,
} from "discord.js";
import { Event } from "../types/Event.js";
import { Config } from "../config/config.js";
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

// Main interaction router handling Slash Commands, Autocomplete, Buttons, and Modals
const event: Event<Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, context) {
    const { commands, logger, config, cooldowns } = context;

    // ------------------------------------------------------------------
    // 1. Button Interactions
    // ------------------------------------------------------------------
    if (interaction.isButton()) {
      // Internal error inspector button attached to error reports
      if (interaction.customId.startsWith("error:info:")) {
        await handleErrorInfoButton(interaction, context);
        return;
      }

      // Note: Place custom button routing here for other features
      return;
    }

    // ------------------------------------------------------------------
    // 2. Autocomplete Interactions
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
    // 3. Slash (Chat Input) Commands
    // ------------------------------------------------------------------
    if (!interaction.isChatInputCommand()) return;

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

      const hasAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
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
      const remaining = cooldowns.check(command.data.name, interaction.user.id, command.cooldown);
      if (remaining !== null) {
        await interaction.reply({
          content: `⏳ Please wait **${remaining}s** before using the \`/${command.data.name}\` command again.`,
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
      await command.execute(interaction, context);
    } catch (error) {
      await handleInteractionError(
        interaction,
        context,
        error,
        `command:${interaction.commandName}`
      );
    }
  },
};

export default event;

/**
 * Handles clicks on the "Inspect Error" button, rendering stack traces to authorized developers.
 */
const handleErrorInfoButton = async (
  interaction: ButtonInteraction,
  context: Parameters<Event<Events.InteractionCreate>["execute"]>[1]
) => {
  const { errorStore, config, logger } = context;
  const id = interaction.customId.replace("error:info:", "");

  if (!errorStore) {
    await interaction.reply({
      content: "Error records are not available because the database is disabled.",
      ephemeral: true,
    });
    return;
  }

  const record = await errorStore.getById(id);
  if (!record) {
    await interaction.reply({ content: "No error record found with that ID.", ephemeral: true });
    return;
  }

  const meta = (record.meta as Record<string, unknown>) ?? {};
  const isOwner = meta.userId === interaction.user.id;
  const member = interaction.inCachedGuild() ? interaction.member : null;
  const isDev = isDeveloper(interaction.user.id, member, config);

  // Restrict stack trace inspection to the triggering user or bot developers
  if (!isOwner && !isDev) {
    await interaction.reply({
      content: "You do not have permission to view this error's internal details.",
      ephemeral: true,
    });
    return;
  }

  const fields = [
    `**Context:** ${record.context}`,
    `**User:** ${meta.userId ? `<@${meta.userId}>` : "Unknown"}`,
    `**Guild:** ${meta.guildId ?? "DM/Unknown"}`,
    `**Channel:** ${meta.channelId ? `<#${meta.channelId}>` : "Unknown"}`,
    `**Message:** ${record.message}`,
  ];

  if (record.stack) {
    fields.push("\n**Stack Trace:**");
    fields.push("```");
    fields.push(record.stack.slice(0, 1500));
    fields.push("```");
  }

  const embed = new EmbedBuilder()
    .setTitle(`Error Details (${record.id})`)
    .setDescription(fields.join("\n"))
    .setColor(0xf04747)
    .setTimestamp(new Date(record.timestamp));

  try {
    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (err) {
    logger.error("Failed to send error detail reply", err);
  }
};
