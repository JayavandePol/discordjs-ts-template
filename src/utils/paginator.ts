import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ComponentType,
  type EmbedBuilder,
  type Message,
  MessageFlags,
} from "discord.js";
import { COLLECTOR_PREFIX } from "../types/Component.js";
import type { RepliableInteraction } from "./error-handler.js";

export type PaginatorOptions = {
  // Duration in milliseconds before the buttons are disabled (default: 60,000ms)
  timeout?: number;

  // Whether the pagination message is ephemeral (default: false)
  ephemeral?: boolean;

  // Who may press the buttons (default: only the user who ran the command)
  filter?: (userId: string) => boolean;

  // Called when a button press fails, e.g. because the message was deleted
  onError?: (error: unknown) => void;
};

type Action = "first" | "prev" | "next" | "last";
const ACTIONS: Action[] = ["first", "prev", "next", "last"];

/**
 * Sends an embed with ⏮️ ◀️ 1/N ▶️ ⏭️ buttons and handles them with a message collector.
 * The buttons use a "collector:" customId so the global interaction router ignores them.
 */
export const paginate = async (
  interaction: RepliableInteraction,
  pages: EmbedBuilder[],
  options: PaginatorOptions = {}
): Promise<void> => {
  if (pages.length === 0) return;

  const { timeout = 60_000, ephemeral = false } = options;
  const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
  const idPrefix = `${COLLECTOR_PREFIX}paginator:${interaction.id}:`;
  const pageAt = (index: number) => pages[index] ?? pages[0]!;

  const createRow = (pageIndex: number, disabled = false) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      button(`${idPrefix}first`, "⏮️", ButtonStyle.Secondary, disabled || pageIndex === 0),
      button(`${idPrefix}prev`, "◀️", ButtonStyle.Primary, disabled || pageIndex === 0),
      new ButtonBuilder()
        .setCustomId(`${idPrefix}indicator`)
        .setLabel(`${pageIndex + 1} / ${pages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      button(`${idPrefix}next`, "▶️", ButtonStyle.Primary, disabled || pageIndex === pages.length - 1),
      button(`${idPrefix}last`, "⏭️", ButtonStyle.Secondary, disabled || pageIndex === pages.length - 1)
    );

  const send = async (payload: { embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[] }) => {
    if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
    const response = await interaction.reply({ ...payload, flags, withResponse: true });
    return response.resource?.message ?? interaction.fetchReply();
  };

  // A single page needs no buttons
  if (pages.length === 1) {
    await send({ embeds: [pageAt(0)], components: [] });
    return;
  }

  let currentPage = 0;
  const message: Message = await send({ embeds: [pageAt(0)], components: [createRow(0)] });

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeout,
    filter: (i) => i.customId.startsWith(idPrefix),
  });

  const reportError = (error: unknown) => options.onError?.(error);

  // Collectors are plain EventEmitters: a rejected listener would become an unhandled rejection
  collector.on("collect", (buttonInteraction: ButtonInteraction) => {
    void (async () => {
      const allowed = options.filter
        ? options.filter(buttonInteraction.user.id)
        : buttonInteraction.user.id === interaction.user.id;

      if (!allowed) {
        await buttonInteraction.reply({
          content: "You cannot control this pagination menu.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const action = buttonInteraction.customId.slice(idPrefix.length) as Action;
      if (!ACTIONS.includes(action)) return;

      if (action === "first") currentPage = 0;
      if (action === "prev") currentPage = Math.max(0, currentPage - 1);
      if (action === "next") currentPage = Math.min(pages.length - 1, currentPage + 1);
      if (action === "last") currentPage = pages.length - 1;

      await buttonInteraction.update({ embeds: [pageAt(currentPage)], components: [createRow(currentPage)] });
    })().catch(reportError);
  });

  // Disable the buttons once the collector times out
  collector.on("end", () => {
    interaction.editReply({ components: [createRow(currentPage, true)] }).catch(reportError);
  });
};

const button = (customId: string, emoji: string, style: ButtonStyle, disabled: boolean) =>
  new ButtonBuilder().setCustomId(customId).setEmoji(emoji).setStyle(style).setDisabled(disabled);
