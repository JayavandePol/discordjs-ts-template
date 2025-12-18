import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { captureError } from "../../utils/error-reporter.js";
import { notifyErrorLogChannel } from "../../utils/error-log.js";
import { Command } from "../../types/Command.js";
import { ErrorMeta } from "../../types/ErrorMeta.js";

const truncate = (value: string, max = 200) =>
  value.length > max ? `${value.slice(0, max - 3)}...` : value;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("errors")
    .setDescription("Developer error tools.")
    .addSubcommand((sub) =>
      sub.setName("test").setDescription("Create a test error and store it.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("lookup")
        .setDescription("Look up an error by ID.")
        .addStringOption((opt) =>
          opt.setName("id").setDescription("Error ID from a prior failure").setRequired(true)
        )
    ),
  access: "developer",
  async execute(interaction, context) {
    const { errorStore, logger } = context;
    if (!errorStore) {
      await interaction.reply({
        content: "Database is disabled; error tooling unavailable.",
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "test") {
      const syntheticError = new Error("Synthetic error from /errors test");
      const meta: ErrorMeta = {
        userId: interaction.user.id,
        guildId: interaction.guildId ?? undefined,
        channelId: interaction.channelId,
        command: "errors test",
      };
      const report = await captureError(logger, syntheticError, "manual-test", errorStore, meta);
      await notifyErrorLogChannel(context, {
        report,
        meta,
        contextLabel: "manual-test",
      });
      await interaction.reply({
        content: `Logged test error with ID: ${report.id}`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "lookup") {
      const id = interaction.options.getString("id", true);
      const record = await errorStore.getById(id);
      if (!record) {
        await interaction.reply({ content: "No error found with that ID.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Error ${record.id}`)
        .setColor(0xf04747)
        .addFields(
          { name: "Context", value: record.context, inline: true },
          { name: "Timestamp", value: new Date(record.timestamp).toUTCString(), inline: true },
          { name: "Name", value: record.name ?? "Unknown", inline: true },
          { name: "Message", value: truncate(record.message, 400) || "None", inline: false }
        );

      if (record.stack) {
        embed.addFields({ name: "Stack", value: truncate(record.stack, 500) });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
