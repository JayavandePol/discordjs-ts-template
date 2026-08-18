import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "../../types/Command.js";
import { detectDialect } from "../../data/db.js";

// Helper function to summarize database connection state for diagnostics
const summarizeDatabase = (config: {
  enabled: boolean;
  url?: string;
  storage?: string;
  logging: boolean;
}) => {
  if (!config.enabled) return "Disabled";
  const dialect = detectDialect({ database: config } as any);
  if (dialect === "postgres") return "Enabled (Drizzle ORM @ PostgreSQL)";
  if (dialect === "mysql") return "Enabled (Drizzle ORM @ MySQL/MariaDB)";
  return `Enabled (Drizzle ORM @ SQLite: ${config.storage ?? "./data/database.sqlite"})`;
};

// Developer status command to inspect environment, memory, latency, and guild counts
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Display internal bot diagnostics, system stats, and connection state."),
  
  // Access control restricted to bot developers
  access: "developer",

  // Ephemeral deferral to ensure reliable response on high-latency hosts
  defer: "ephemeral",

  async execute(interaction, { config, client }) {
    const { ws } = client;
    const memoryUsage = process.memoryUsage();
    const ramMb = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
    const uptimeSeconds = Math.floor(process.uptime());

    const embed = new EmbedBuilder()
      .setTitle("Bot System Diagnostics")
      .setColor(0x5865f2)
      .addFields(
        { name: "Bot Account", value: `${client.user?.tag} (\`${client.user?.id}\`)`, inline: true },
        { name: "Gateway Latency", value: `\`${Math.round(ws.ping)} ms\``, inline: true },
        { name: "RAM (Heap Used)", value: `\`${ramMb} MB\``, inline: true },
        { name: "Uptime", value: `<t:${Math.floor(Date.now() / 1000) - uptimeSeconds}:R>`, inline: true },
        { name: "Guild Count", value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: "Cached Users", value: `\`${client.users.cache.size}\``, inline: true },
        { name: "Multi-Guild Mode", value: config.multiGuild ? "Enabled (Global Scope)" : "Disabled (Guild Preferred)", inline: true },
        { name: "Command Auto-Register", value: config.autoRegisterCommands ? "Enabled" : "Disabled (CLI Managed)", inline: true },
        { name: "Database State", value: summarizeDatabase(config.database), inline: false }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
