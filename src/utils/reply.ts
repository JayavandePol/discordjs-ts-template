import {
  CommandInteraction,
  MessageComponentInteraction,
  MessageFlags,
  ModalSubmitInteraction,
  type ActionRowBuilder,
  type ButtonBuilder,
  type EmbedBuilder,
} from "discord.js";

/** Any interaction that can be replied to: commands, context menus, components and modals. */
export type RepliableInteraction = CommandInteraction | MessageComponentInteraction | ModalSubmitInteraction;

export type EphemeralPayload = {
  content?: string;
  embeds?: EmbedBuilder[];
  components?: ActionRowBuilder<ButtonBuilder>[];
};

/**
 * Sends a private response without clobbering what the command already sent:
 * - not answered yet  -> ephemeral reply
 * - deferred          -> editReply (visibility follows the defer: public defers stay public)
 * - already replied   -> ephemeral followUp, so the command's real output stays intact
 */
export const sendEphemeral = async (interaction: RepliableInteraction, payload: EphemeralPayload) => {
  if (interaction.replied) {
    await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
  } else if (interaction.deferred) {
    await interaction.editReply(payload);
  } else {
    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
  }
};
