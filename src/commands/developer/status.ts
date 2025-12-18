import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../types/Command.js";

const summarizeDatabase = (config: {
  enabled: boolean;
  dialect?: string;
  url?: string;
  storage?: string;
  host?: string;
  database?: string;
}) => {
  if (!config.enabled) return "Disabled";
  if (config.url) return `Enabled via URL (${config.dialect ?? "auto"})`;
  if (config.dialect === "sqlite") return `SQLite (${config.storage ?? "memory"})`;
  return `${config.dialect ?? "unknown"} @ ${config.host ?? "host?"}/${config.database ?? "db?"}`;
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show bot diagnostics (dev only)."),
  access: "developer",
  async execute(interaction, { config, client }) {
    const { ws } = client;
    const embed = new EmbedBuilder()
      .setTitle("Bot Status")
      .setColor(0x5865f2)
      .addFields(
        { name: "User", value: client.user?.tag ?? "Unknown", inline: true },
        { name: "Latency", value: `${Math.round(ws.ping)} ms`, inline: true },
        { name: "Multi-guild", value: config.multiGuild ? "Enabled (global commands)" : "Disabled (prefers guild commands)", inline: true },
        { name: "Command scope", value: config.multiGuild ? "Global" : config.guildId ? "Guild" : "Global", inline: true },
        { name: "Database", value: summarizeDatabase(config.database), inline: false },
        { name: "Guild count", value: client.guilds.cache.size.toString(), inline: true }
      )
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
