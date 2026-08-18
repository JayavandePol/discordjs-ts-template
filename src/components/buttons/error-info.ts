import { EmbedBuilder, GuildMember } from "discord.js";
import { ButtonHandler } from "../../types/Component.js";
import { Config } from "../../config/config.js";

// Helper function to verify developer access
const isDeveloper = (
  userId: string,
  member: GuildMember | null,
  config: Config
): boolean => {
  if (config.devUserIds.includes(userId)) return true;
  if (config.devRoleId && member && member.roles.cache.has(config.devRoleId)) return true;
  return false;
};

// Modular button handler for error report inspection
const button: ButtonHandler = {
  // Matches customId starting with "error:info:"
  customId: /^error:info:.+$/,

  async execute(interaction, context) {
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

    // Restrict stack trace inspection to triggering user or authorized bot developers
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
  },
};

export default button;
