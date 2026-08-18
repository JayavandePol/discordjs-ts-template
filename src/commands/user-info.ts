import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  UserContextMenuCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../types/Command.js";

// User Context Menu command triggered by right-clicking any user in Discord -> Apps -> "User Info"
const command: Command<UserContextMenuCommandInteraction> = {
  data: new ContextMenuCommandBuilder()
    .setName("User Info")
    .setType(ApplicationCommandType.User),

  cooldown: 5,
  defer: "ephemeral",

  async execute(interaction, { logger }) {
    const targetUser = interaction.targetUser;
    const targetMember = interaction.targetMember;

    const embed = new EmbedBuilder()
      .setTitle(`User Profile: ${targetUser.tag}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor(0x5865f2)
      .addFields(
        { name: "User ID", value: `\`${targetUser.id}\``, inline: true },
        { name: "Bot Account", value: targetUser.bot ? "Yes" : "No", inline: true },
        { name: "Account Created", value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true }
      )
      .setTimestamp();

    if (targetMember && "joinedTimestamp" in targetMember && targetMember.joinedTimestamp) {
      embed.addFields({
        name: "Joined Server",
        value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`,
        inline: true,
      });
    }

    await interaction.editReply({ embeds: [embed] });
    logger.info("Handled User Context Menu: User Info", {
      executor: interaction.user.id,
      target: targetUser.id,
    });
  },
};

export default command;
