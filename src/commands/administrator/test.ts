import { SlashCommandBuilder } from "discord.js";
import { Command } from "../../types/Command.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("admintest").setDescription("Check bot latency."),
  async execute(interaction, { logger }) {
    const sent = await interaction.reply({ content: "Testing...", fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const heartbeat = Math.round(interaction.client.ws.ping);
    await interaction.editReply(`Test ping completed! Round-trip: ${latency}ms. Heartbeat: ${heartbeat}ms.`);
    logger.info("Handled /admintest", { user: interaction.user.id, latency, heartbeat });
  },
};

export default command;
