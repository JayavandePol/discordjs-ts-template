import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/Command.js";
import { createSuccessEmbed } from "../../utils/embeds.js";

// Administrator-only test command demonstrating native permission gating and subcommand routing
const command: Command = {
  data: new SlashCommandBuilder()
    .setName("admintest")
    .setDescription("Administrator diagnostics and testing utilities.")
    // Restrict command visibility natively in Discord client to users with Administrator permission
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // Ensure the command cannot be executed inside Direct Messages
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName("ping")
        .setDescription("Perform an administrative connectivity and latency test.")
    )
    .addSubcommand((sub) =>
      sub
        .setName("server")
        .setDescription("Display administrative overview for the current server.")
    ),

  // Access control tag (enforced as fallback in interaction handler)
  access: "admin",

  // 3-second cooldown
  cooldown: 3,

  // Command handler
  async execute(interaction, { logger }) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "ping") {
      const sent = await interaction.reply({ content: "Running diagnostic check...", fetchReply: true });
      const latency = sent.createdTimestamp - interaction.createdTimestamp;
      const heartbeat = Math.round(interaction.client.ws.ping);

      const embed = createSuccessEmbed("Admin Diagnostic Check", "Guild connectivity test results:")
        .addFields(
          { name: "Message Latency", value: `\`${latency}ms\``, inline: true },
          { name: "Gateway Heartbeat", value: `\`${heartbeat}ms\``, inline: true }
        );

      await interaction.editReply({ content: null, embeds: [embed] });
      logger.info("Executed /admintest ping", { guild: interaction.guildId, user: interaction.user.id });
      return;
    }

    if (subcommand === "server") {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: "This subcommand can only be run in a server.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Server Overview: ${guild.name}`)
        .setColor(0x5865f2)
        .addFields(
          { name: "Server ID", value: `\`${guild.id}\``, inline: true },
          { name: "Member Count", value: `${guild.memberCount}`, inline: true },
          { name: "Owner ID", value: `<@${guild.ownerId}>`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
      logger.info("Executed /admintest server", { guild: guild.id, user: interaction.user.id });
      return;
    }
  },
};

export default command;
