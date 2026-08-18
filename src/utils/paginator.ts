import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  Message,
} from "discord.js";
import { RepliableInteraction } from "./error-handler.js";

export type PaginatorOptions = {
  // Duration in milliseconds before pagination buttons expire and disable (default: 60,000ms)
  timeout?: number;

  // Whether the pagination message is ephemeral (default: false)
  ephemeral?: boolean;

  // Optional custom authorization filter (defaults to allowing only the user who ran the command)
  filter?: (userId: string) => boolean;
};

/**
 * Creates and manages an interactive button paginator for multi-page embed responses.
 *
 * @param interaction The Discord interaction initiating the pagination
 * @param pages Array of EmbedBuilder instances to navigate through
 * @param options Paginator customization options
 */
export const paginate = async (
  interaction: RepliableInteraction,
  pages: EmbedBuilder[],
  options: PaginatorOptions = {}
): Promise<void> => {
  if (pages.length === 0) return;

  const { timeout = 60_000, ephemeral = false } = options;

  // If there is only one page, send directly without navigation action rows
  if (pages.length === 1) {
    const singlePayload = { embeds: [pages[0]], components: [], ephemeral };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(singlePayload);
    } else {
      await interaction.reply(singlePayload);
    }
    return;
  }

  let currentPage = 0;

  // Helper to generate navigation action row with updated enabled/disabled states
  const createActionRow = (pageIndex: number): ActionRowBuilder<ButtonBuilder> => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("paginator:first")
        .setEmoji("⏮️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === 0),

      new ButtonBuilder()
        .setCustomId("paginator:prev")
        .setEmoji("◀️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex === 0),

      new ButtonBuilder()
        .setCustomId("paginator:indicator")
        .setLabel(`${pageIndex + 1} / ${pages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),

      new ButtonBuilder()
        .setCustomId("paginator:next")
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(pageIndex === pages.length - 1),

      new ButtonBuilder()
        .setCustomId("paginator:last")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === pages.length - 1)
    );
  };

  const initialPayload = {
    embeds: [pages[currentPage]],
    components: [createActionRow(currentPage)],
    ephemeral,
  };

  // Send initial message
  let responseMessage: Message;
  if (interaction.deferred || interaction.replied) {
    const res = await interaction.editReply(initialPayload);
    responseMessage = res instanceof Message ? res : await interaction.fetchReply();
  } else {
    const res = await interaction.reply({ ...initialPayload, fetchReply: true });
    responseMessage = res instanceof Message ? res : await interaction.fetchReply();
  }

  // Create button interaction collector
  const collector = responseMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout,
  });

  collector.on("collect", async (buttonInteraction) => {
    // Enforce authorization filter (restrict interaction to the user who triggered the paginator)
    const allowed = options.filter
      ? options.filter(buttonInteraction.user.id)
      : buttonInteraction.user.id === interaction.user.id;

    if (!allowed) {
      await buttonInteraction.reply({
        content: "You cannot control this pagination menu.",
        ephemeral: true,
      });
      return;
    }

    switch (buttonInteraction.customId) {
      case "paginator:first":
        currentPage = 0;
        break;
      case "paginator:prev":
        currentPage = Math.max(0, currentPage - 1);
        break;
      case "paginator:next":
        currentPage = Math.min(pages.length - 1, currentPage + 1);
        break;
      case "paginator:last":
        currentPage = pages.length - 1;
        break;
    }

    // Update message with the newly selected page and fresh button states
    await buttonInteraction.update({
      embeds: [pages[currentPage]],
      components: [createActionRow(currentPage)],
    });
  });

  // Disable all buttons when the collector times out
  collector.on("end", async () => {
    try {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("paginator:first_disabled")
          .setEmoji("⏮️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("paginator:prev_disabled")
          .setEmoji("◀️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("paginator:indicator_disabled")
          .setLabel(`${currentPage + 1} / ${pages.length}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("paginator:next_disabled")
          .setEmoji("▶️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),

        new ButtonBuilder()
          .setCustomId("paginator:last_disabled")
          .setEmoji("⏭️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );

      await interaction.editReply({ components: [disabledRow] });
    } catch {
      // Ignore errors if message was already deleted
    }
  });
};
