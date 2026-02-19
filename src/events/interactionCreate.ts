import {
  ButtonInteraction,
  Events,
  Interaction,
  PermissionsBitField,
  EmbedBuilder,
} from "discord.js";
import { Event } from "../types/Event.js";
import { handleInteractionError } from "../utils/error-handler.js";

const event: Event<Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction, context) {
    const { commands, logger } = context;

    if (interaction.isButton() && interaction.customId.startsWith("error:info:")) {
      await handleErrorInfoButton(interaction, context);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
      logger.warn("Received unknown command", { command: interaction.commandName });
      await interaction.reply({ content: "Command not recognized.", ephemeral: true });
      return;
    }

    if (command.access === "developer" || command.devOnly) {
      const devId = context.config.devId;
      if (!devId) {
        logger.warn("Dev-only command used but DEV_ID not set", { command: command.data.name });
        await interaction.reply({
          content: "Developer commands are not configured. Set DEV_ID in the environment.",
          ephemeral: true,
        });
        return;
      }
      if (!interaction.inCachedGuild()) {
        await interaction.reply({
          content: "Developer commands can only be used inside a guild.",
          ephemeral: true,
        });
        return;
      }
      const hasDevRole = interaction.member.roles.cache.has(devId);
      if (!hasDevRole) {
        logger.warn("Unauthorized dev-only command attempt", {
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

    if (command.access === "admin") {
      if (!interaction.inCachedGuild()) {
        await interaction.reply({
          content: "Admin commands can only be used inside a guild.",
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

    try {
      await command.execute(interaction, context);
    } catch (error) {
      await handleInteractionError(interaction, context, error, `command:${interaction.commandName}`);
    }
  },
};

export default event;

const handleErrorInfoButton = async (
  interaction: ButtonInteraction,
  context: Parameters<Event<Events.InteractionCreate>["execute"]>[1]
) => {
  const { errorStore, config, logger } = context;
  const id = interaction.customId.replace("error:info:", "");

  if (!errorStore) {
    await interaction.reply({
      content: "Error records are not available.",
      ephemeral: true,
    });
    return;
  }

  const record = await errorStore.getById(id);
  if (!record) {
    await interaction.reply({ content: "No error found with that ID.", ephemeral: true });
    return;
  }

  const meta = record.meta ?? {};
  const devId = config.devId;
  const isOwner = meta.userId === interaction.user.id;
  const isDev = devId && interaction.inCachedGuild() && interaction.member.roles.cache.has(devId);
  if (!isOwner && !isDev) {
    await interaction.reply({
      content: "You are not allowed to view this error's details.",
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
    fields.push("\n**Stack:**");
    fields.push("```");
    fields.push(record.stack.slice(0, 1500));
    fields.push("```");
  }

  const embed = new EmbedBuilder()
    .setTitle(`Error ${record.id}`)
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
