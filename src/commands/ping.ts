import { SlashCommandBuilder } from "discord.js";
import { defineSlashCommand } from "../types/Command.js";
import { createSuccessEmbed } from "../utils/embeds.js";

// Public ping command demonstrating latency measurement, cooldown, and embed formatting
const command = defineSlashCommand({
  // Define slash command metadata
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check bot latency and Discord API gateway heartbeat."),

  // 5-second cooldown per user to prevent spamming
  cooldown: 5,

  // Command handler
  async execute(interaction, { logger }) {
    // Reply initially to calculate message round-trip latency
    const response = await interaction.reply({ content: "Pinging...", withResponse: true });
    const sent = response.resource?.message;
    const latency = sent ? sent.createdTimestamp - interaction.createdTimestamp : 0;
    const heartbeat = Math.round(interaction.client.ws.ping);

    // Format response with standard success embed
    const embed = createSuccessEmbed("🏓 Pong!", "Current latency statistics for the bot:")
      .addFields(
        { name: "Round-trip Latency", value: `\`${latency}ms\``, inline: true },
        { name: "Websocket Heartbeat", value: `\`${heartbeat}ms\``, inline: true }
      );

    await interaction.editReply({ content: null, embeds: [embed] });
    logger.info("Handled /ping", { user: interaction.user.id, latency, heartbeat });
  },
});

export default command;
