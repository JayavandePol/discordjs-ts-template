import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { BotContext } from "../types/Context.js";
import { ErrorReport } from "./error-reporter.js";
import { ErrorMeta } from "../types/ErrorMeta.js";

const isSendableChannel = (
  channel: unknown
): channel is TextChannel | ThreadChannel => {
  return (
    !!channel &&
    typeof channel === "object" &&
    "isTextBased" in channel &&
    typeof (channel as any).isTextBased === "function" &&
    (channel as any).isTextBased() &&
    "send" in channel
  );
};

export const notifyErrorLogChannel = async (
  context: BotContext,
  params: { report: ErrorReport; meta?: ErrorMeta; contextLabel: string }
) => {
  const channelId = context.config.errorLogChannelId;
  if (!channelId) return;

  try {
    const channel = await context.client.channels.fetch(channelId);
    if (!isSendableChannel(channel)) return;

    const embed = new EmbedBuilder()
      .setTitle("Bot Error Captured")
      .setColor(0xf04747)
      .addFields(
        { name: "Error ID", value: params.report.id, inline: true },
        { name: "Context", value: params.contextLabel, inline: true },
        { name: "User", value: params.meta?.userId ? `<@${params.meta.userId}>` : "Unknown", inline: true },
        { name: "Command", value: params.meta?.command ?? "Unknown", inline: true },
        { name: "Guild", value: params.meta?.guildId ?? "DM/Unknown", inline: true },
        { name: "Channel", value: params.meta?.channelId ? `<#${params.meta.channelId}>` : "Unknown", inline: true }
      )
      .setTimestamp(new Date());

    const button = new ButtonBuilder()
      .setCustomId(`error:info:${params.report.id}`)
      .setLabel("Details")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    context.logger.error("Failed to dispatch error log to channel", err);
  }
};
