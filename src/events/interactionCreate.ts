import {
  ButtonInteraction,
  Events,
  Interaction,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { Event } from "../types/Event.js";
import { captureError } from "../utils/error-reporter.js";
import { notifyErrorLogChannel } from "../utils/error-log.js";
import { ErrorMeta } from "../types/ErrorMeta.js";

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
      if (interaction.user.id !== devId) {
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

    const errorMeta: ErrorMeta = {
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
      channelId: interaction.channelId,
      command: interaction.commandName,
    };

    try {
      await command.execute(interaction, context);
    } catch (error) {
      const report = await captureError(
        logger,
        error,
        `command:${interaction.commandName}`,
        context.errorStore,
        errorMeta
      );
      await notifyErrorLogChannel(context, {
        report,
        meta: errorMeta,
        contextLabel: `command:${interaction.commandName}`,
      });

      const embed = new EmbedBuilder()
        .setTitle("Something went wrong")
        .setDescription(
          "We ran into an unexpected error while handling your request. Please contact the developers and share this error ID so we can investigate.\n\n" +
            `Error ID: **${report.id}**`
        )
        .setColor(0xf04747);

      const components: ActionRowBuilder<ButtonBuilder>[] = [];

      if (context.config.devId) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setLabel("Contact Developer")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://discord.com/users/${context.config.devId}`)
        );
        components.push(row);
      }

      const response = { embeds: [embed], components, ephemeral: true };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(response);
      } else {
        await interaction.reply(response);
      }
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
  const isDev = devId && interaction.user.id === devId;
  if (!isOwner && !isDev) {
    await interaction.reply({
      content: "You are not allowed to view this error's details.",
      ephemeral: true,
    });
    return;
  }

  const description = [
    `**Context:** ${record.context}`,
    `**User:** ${meta.userId ? `<@${meta.userId}>` : "Unknown"}`,
    `**Guild:** ${meta.guildId ?? "DM/Unknown"}`,
    `**Channel:** ${meta.channelId ? `<#${meta.channelId}>` : "Unknown"}`,
    `**Message:** ${record.message}`,
  ];

  if (record.stack) {
    description.push("\n**Stack:**");
    description.push("```");
    description.push(record.stack.slice(0, 1500));
    description.push("```");
  }

  try {
    await interaction.reply({
      content: description.join("\n"),
      ephemeral: true,
    });
  } catch (err) {
    logger.error("Failed to send error detail reply", err);
  }
};
