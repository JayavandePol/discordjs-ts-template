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

// Type guard to check if a Discord channel supports message sending
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

// Rate-limiting map for error notification spam protection: ErrorID -> { count, timestamp }
const throttleMap = new Map<string, { count: number; timestamp: number }>();
const THROTTLE_LIMIT = 5;
const THROTTLE_WINDOW_MS = 60 * 1000; // 60-second sliding window

/**
 * Sends a structured error card to the developer error log channel (if ERRORLOGCHANNEL_ID is set).
 * Features anti-spam throttling for repeated identical exceptions and includes an interactive "Details" button.
 */
export const notifyErrorLogChannel = async (
  context: BotContext,
  params: { report: ErrorReport; meta?: ErrorMeta; contextLabel: string }
) => {
  const channelId = context.config.errorLogChannelId;
  if (!channelId) return;

  const now = Date.now();
  const throttleRecord = throttleMap.get(params.report.id);

  // Apply throttle check
  if (throttleRecord) {
    if (now - throttleRecord.timestamp < THROTTLE_WINDOW_MS) {
      throttleRecord.count++;
      if (throttleRecord.count > THROTTLE_LIMIT) {
        context.logger.warn(
          `Throttled error log to Discord channel for ID ${params.report.id} (seen ${throttleRecord.count} times in 60s)`
        );
        return; // Suppress notification to avoid channel spam
      }
    } else {
      throttleMap.set(params.report.id, { count: 1, timestamp: now });
    }
  } else {
    throttleMap.set(params.report.id, { count: 1, timestamp: now });
  }

  // Periodic throttle map cleanup
  if (Math.random() < 0.1) {
    for (const [key, value] of throttleMap.entries()) {
      if (now - value.timestamp > THROTTLE_WINDOW_MS) {
        throttleMap.delete(key);
      }
    }
  }

  try {
    const channel = await context.client.channels.fetch(channelId);
    if (!isSendableChannel(channel)) return;

    const embed = new EmbedBuilder()
      .setTitle("Bot Error Captured")
      .setColor(0xf04747)
      .addFields(
        { name: "Error ID", value: `\`${params.report.id}\``, inline: true },
        { name: "Context", value: `\`${params.contextLabel}\``, inline: true },
        { name: "User", value: params.meta?.userId ? `<@${params.meta.userId}>` : "Unknown", inline: true },
        { name: "Command", value: params.meta?.command ?? "Unknown", inline: true },
        { name: "Guild", value: params.meta?.guildId ?? "DM/Unknown", inline: true },
        { name: "Channel", value: params.meta?.channelId ? `<#${params.meta.channelId}>` : "Unknown", inline: true }
      )
      .setTimestamp(new Date());

    // Button allowing developers to view the full stack trace securely
    const button = new ButtonBuilder()
      .setCustomId(`error:info:${params.report.id}`)
      .setLabel("Inspect Stack")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    await channel.send({ embeds: [embed], components: [row] });
  } catch (err) {
    context.logger.error("Failed to dispatch error log to channel", err);
  }
};
