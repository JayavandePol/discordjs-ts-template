import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { defineSlashCommand } from "../../types/Command.js";
import type { ErrorEvent } from "../../data/error-store.js";
import { handleInteractionError } from "../../utils/error-handler.js";
import { EmbedColors } from "../../utils/embeds.js";
import { paginate } from "../../utils/paginator.js";

// Discord limits: autocomplete choice names are 1-100 characters, embed field values 1024
const truncate = (value: string, max = 200) => (value.length > max ? `${value.slice(0, max - 3)}...` : value);
const codeBlock = (value: string, max: number) => `\`\`\`\n${truncate(value, max)}\n\`\`\``;
const relative = (date: Date) => `<t:${Math.floor(date.getTime() / 1000)}:R>`;

const detailEmbed = (record: ErrorEvent) => {
  const meta = record.meta ?? {};
  const embed = new EmbedBuilder()
    .setTitle(`Error Report ${record.id}`)
    .setColor(EmbedColors.Error)
    .addFields(
      { name: "Context", value: `\`${truncate(record.context, 100)}\``, inline: true },
      { name: "Occurrences", value: `\`${record.occurrences}\` (same fingerprint)`, inline: true },
      { name: "When", value: relative(record.createdAt), inline: true },
      { name: "User", value: meta.userId ? `<@${meta.userId}>` : "Unknown", inline: true },
      { name: "Guild", value: meta.guildId ?? "DM/Unknown", inline: true },
      { name: "Channel", value: meta.channelId ? `<#${meta.channelId}>` : "Unknown", inline: true },
      { name: "Error", value: `**${record.name ?? "Error"}**: ${truncate(record.message, 400) || "None"}` }
    )
    .setFooter({ text: `Fingerprint ${record.fingerprint}` });

  if (record.stack) embed.addFields({ name: "Stack Trace", value: codeBlock(record.stack, 900) });
  return embed;
};

// Developer error inspector: look up a report by ID, or browse the latest ones
const command = defineSlashCommand({
  data: new SlashCommandBuilder()
    .setName("errors")
    .setDescription("Developer diagnostics and error inspection tools.")
    .addSubcommand((sub) => sub.setName("test").setDescription("Trigger a synthetic error to test reporting."))
    .addSubcommand((sub) =>
      sub
        .setName("lookup")
        .setDescription("Show the full report for an error ID.")
        .addStringOption((opt) =>
          opt.setName("id").setDescription("Error ID (supports autocomplete)").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Browse the latest error reports.")),

  access: "developer",

  async autocomplete(interaction, { errorStore }) {
    if (!errorStore) {
      await interaction.respond([]);
      return;
    }

    const matches = await errorStore.search(interaction.options.getFocused(), 25);
    await interaction.respond(
      matches.map((record) => ({
        name: truncate(`${record.id} · ${record.context} · ${record.message}`, 100),
        value: record.id,
      }))
    );
  },

  async execute(interaction, context) {
    const { errorStore, logger } = context;
    if (!errorStore) {
      await interaction.reply({
        content: "The database is disabled, so error reports are only written to the logs.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "test") {
      await handleInteractionError(interaction, context, new Error("Synthetic test error from /errors test"), "manual-test");
      return;
    }

    if (sub === "lookup") {
      const id = interaction.options.getString("id", true).trim();
      const record = await errorStore.getById(id);
      if (!record) {
        await interaction.reply({ content: `No error report with ID \`${id}\`.`, flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({ embeds: [detailEmbed(record)], flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "list") {
      const records = await errorStore.listLatest(20);
      if (records.length === 0) {
        await interaction.reply({ content: "No error reports stored.", flags: MessageFlags.Ephemeral });
        return;
      }

      const pages = records.map((record, index) =>
        detailEmbed(record).setAuthor({ name: `Report ${index + 1} of ${records.length}` })
      );
      await paginate(interaction, pages, {
        ephemeral: true,
        onError: (error) => logger.warn("Error list paginator failed", error),
      });
    }
  },
});

export default command;
