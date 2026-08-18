import {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../types/Command.js";

// Message Context Menu command triggered by right-clicking any message -> Apps -> "Quote Message"
const command: Command<MessageContextMenuCommandInteraction> = {
  data: new ContextMenuCommandBuilder()
    .setName("Quote Message")
    .setType(ApplicationCommandType.Message),

  cooldown: 3,

  async execute(interaction, { logger }) {
    const targetMessage = interaction.targetMessage;

    const embed = new EmbedBuilder()
      .setAuthor({
        name: targetMessage.author.tag,
        iconURL: targetMessage.author.displayAvatarURL(),
      })
      .setDescription(targetMessage.content || "*(No text content)*")
      .setColor(0x5865f2)
      .setFooter({ text: `Message ID: ${targetMessage.id}` })
      .setTimestamp(new Date(targetMessage.createdTimestamp));

    // Include first image attachment if available
    const imageAttachment = targetMessage.attachments.find((att) =>
      att.contentType?.startsWith("image/")
    );
    if (imageAttachment) {
      embed.setImage(imageAttachment.url);
    }

    await interaction.reply({ embeds: [embed] });
    logger.info("Handled Message Context Menu: Quote Message", {
      executor: interaction.user.id,
      messageId: targetMessage.id,
    });
  },
};

export default command;
