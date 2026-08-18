import {
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { Command } from "../../types/Command.js";
import { handleInteractionError } from "../../utils/error-handler.js";
import { paginate } from "../../utils/paginator.js";

// Helper to truncate lengthy string fields for Discord embed constraints
const truncate = (value: string, max = 200) =>
  value.length > max ? `${value.slice(0, max - 3)}...` : value;

// Developer error inspector command with subcommands, dynamic autocomplete, and paginated error browsing
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("errors")
    .setDescription("Developer diagnostics and error inspection tools.")
    .addSubcommand((sub) =>
      sub.setName("test").setDescription("Simulate an unexpected synthetic error and store it.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("lookup")
        .setDescription("Look up full crash details and stack trace by Error ID.")
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("Error ID from a prior failure (supports autocomplete)")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Browse the latest logged errors with an interactive paginator.")
    ),

  // Access control tag restricted to developers
  access: "developer",

  // Dynamic autocompletion for recent Error IDs in the database
  async autocomplete(interaction, { errorStore }) {
    if (!errorStore) return;

    const focusedValue = interaction.options.getFocused().toLowerCase();
    const latestErrors = await errorStore.listLatest(15);

    // Filter results matching the user's typed input
    const filtered = latestErrors
      .filter((err) => err.id.toLowerCase().includes(focusedValue) || err.context.toLowerCase().includes(focusedValue))
      .slice(0, 25)
      .map((err) => ({
        name: `${err.id} (${err.context}) - ${truncate(err.message, 40)}`,
        value: err.id,
      }));

    await interaction.respond(filtered);
  },

  // Primary command execution
  async execute(interaction, context) {
    const { errorStore } = context;
    if (!errorStore) {
      await interaction.reply({
        content: "Database is disabled; error tracking storage is unavailable.",
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    // 1. Simulate synthetic error
    if (sub === "test") {
      const syntheticError = new Error("Synthetic test error triggered via /errors test");
      await handleInteractionError(interaction, context, syntheticError, "manual-test");
      return;
    }

    // 2. Lookup error by ID
    if (sub === "lookup") {
      const id = interaction.options.getString("id", true);
      const record = await errorStore.getById(id);
      if (!record) {
        await interaction.reply({ content: `No error record found matching ID \`${id}\`.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Error Report (${record.id})`)
        .setColor(0xf04747)
        .addFields(
          { name: "Context Label", value: `\`${record.context}\``, inline: true },
          { name: "Severity", value: `\`${record.severity}\``, inline: true },
          { name: "Occurrences", value: `\`${record.occurrences}\``, inline: true },
          { name: "User", value: record.meta?.userId ? `<@${record.meta.userId}>` : "Unknown", inline: true },
          { name: "Guild", value: (record.meta?.guildId as string) ?? "DM/Unknown", inline: true },
          { name: "Channel", value: record.meta?.channelId ? `<#${record.meta.channelId}>` : "Unknown", inline: true },
          { name: "Command / Handler", value: record.meta?.command ?? "N/A", inline: true },
          { name: "Timestamp", value: new Date(record.timestamp).toUTCString(), inline: true },
          { name: "Error Name", value: record.name ?? "Error", inline: true },
          { name: "Error Message", value: truncate(record.message, 400) || "None", inline: false }
        );

      if (record.stack) {
        embed.addFields({ name: "Stack Trace", value: `\`\`\`\n${truncate(record.stack, 500)}\n\`\`\`` });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // 3. Paginated list of latest errors
    if (sub === "list") {
      const records = await errorStore.listLatest(20);

      if (records.length === 0) {
        await interaction.reply({ content: "No logged error records found in the database.", ephemeral: true });
        return;
      }

      // Generate a page for each error record
      const pages = records.map((record, index) =>
        new EmbedBuilder()
          .setTitle(`Logged Error #${index + 1} (${record.id})`)
          .setColor(0xf04747)
          .addFields(
            { name: "Context", value: `\`${record.context}\``, inline: true },
            { name: "Occurrences", value: `\`${record.occurrences}\``, inline: true },
            { name: "Timestamp", value: new Date(record.timestamp).toUTCString(), inline: true },
            { name: "Message", value: truncate(record.message, 250) || "None", inline: false },
            { name: "Stack Preview", value: record.stack ? `\`\`\`\n${truncate(record.stack, 300)}\n\`\`\`` : "None", inline: false }
          )
          .setFooter({ text: `Use /errors lookup ${record.id} for complete details` })
      );

      await paginate(interaction, pages, { ephemeral: true });
    }
  },
};

export default command;
