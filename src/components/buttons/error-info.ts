import { EmbedBuilder, MessageFlags } from "discord.js";
import { defineButton } from "../../types/Component.js";
import { EmbedColors } from "../../utils/embeds.js";

// Keeps the embed description within Discord's 4096-character limit
const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, max - 3)}...` : value;

// "Inspect Stack" button on error log messages. Stack traces and internal paths are for
// developers only, so this button uses the same developer access check as /errors.
const button = defineButton({
  customId: /^error:info:.+$/,
  access: "developer",

  async execute(interaction, { errorStore }) {
    const id = interaction.customId.slice("error:info:".length);

    if (!errorStore) {
      await interaction.reply({
        content: "Error records are not available because the database is disabled.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const record = await errorStore.getById(id);
    if (!record) {
      await interaction.reply({ content: "No error record found with that ID.", flags: MessageFlags.Ephemeral });
      return;
    }

    const meta = record.meta ?? {};
    const lines = [
      `**Context:** ${record.context}`,
      `**User:** ${meta.userId ? `<@${meta.userId}>` : "Unknown"}`,
      `**Guild:** ${meta.guildId ?? "DM/Unknown"}`,
      `**Channel:** ${meta.channelId ? `<#${meta.channelId}>` : "Unknown"}`,
      `**Message:** ${truncate(record.message, 500)}`,
    ];

    if (record.stack) {
      lines.push("\n**Stack Trace:**", "```", truncate(record.stack, 1500), "```");
    }

    const embed = new EmbedBuilder()
      .setTitle(`Error Details (${record.id})`)
      .setDescription(lines.join("\n"))
      .setColor(EmbedColors.Error)
      .setTimestamp(new Date(record.timestamp));

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
});

export default button;
