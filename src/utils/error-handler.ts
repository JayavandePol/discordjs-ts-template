import {
  CommandInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { BotContext } from "../types/Context.js";
import { ErrorMeta } from "../types/ErrorMeta.js";
import { captureError } from "./error-reporter.js";
import { notifyErrorLogChannel } from "./error-log.js";

/**
 * Any interaction type that supports reply/editReply.
 * Covers: slash commands, buttons, select menus, modals, context menus.
 */
export type RepliableInteraction =
  | CommandInteraction
  | MessageComponentInteraction
  | ModalSubmitInteraction;

/**
 * Universal error handler for all interaction types.
 *
 * Captures the error, creates/increments a deterministic DB record, notifies
 * the error log channel, and replies to the user with a friendly embed + "Contact Developer" button.
 *
 * Most slash commands don't need manual try/catch as the central handler in `interactionCreate.ts`
 * automatically catches unhandled exceptions.
 */
export const handleInteractionError = async (
  interaction: RepliableInteraction,
  context: BotContext,
  error: unknown,
  contextLabel: string,
  meta?: ErrorMeta
): Promise<void> => {
  // Extract interaction input options for contextual debugging
  const options: Record<string, string | number | boolean> = {};

  if (interaction.isChatInputCommand() && interaction.options.data) {
    for (const opt of interaction.options.data) {
      if (opt.value !== undefined) {
        options[opt.name] = opt.value;
      }
    }
  } else if (interaction.isModalSubmit()) {
    for (const [key, field] of interaction.fields.fields) {
      if ("value" in field && field.value !== null && field.value !== undefined) {
        options[key] = field.value;
      }
    }
  }

  // Construct error metadata snapshot
  const errorMeta: ErrorMeta = meta ?? {
    userId: interaction.user.id,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId ?? undefined,
    command: "commandName" in interaction ? interaction.commandName : undefined,
    options: Object.keys(options).length > 0 ? options : undefined,
  };

  // Expected user errors (validation, insufficient balance, etc.) should not generate crash reports
  if (error && typeof error === "object" && "name" in error && error.name === "UserError") {
    const message = "message" in error ? String(error.message) : "An expected error occurred.";

    const response = {
      embeds: [new EmbedBuilder().setTitle("Notice").setDescription(message).setColor(0xeeb902)],
      ephemeral: true,
    };

    try {
      if (interaction.deferred || interaction.replied) await interaction.editReply(response);
      else await interaction.reply(response);
    } catch (replyError) {
      context.logger.error("Failed to send UserError response", replyError);
    }
    return;
  }

  // Capture unexpected crash report, persist to DB and log
  const report = await captureError(
    context.logger,
    error,
    contextLabel,
    context.errorStore,
    errorMeta
  );

  // Send notification to designated developer error log channel
  await notifyErrorLogChannel(context, {
    report,
    meta: errorMeta,
    contextLabel,
  });

  // User-facing friendly error embed with error ID for reference
  const embed = new EmbedBuilder()
    .setTitle("Something went wrong")
    .setDescription(
      "We ran into an unexpected error while handling your request. " +
        "Please contact the developers and share this error ID so we can investigate.\n\n" +
        `Error ID: **${report.id}**`
    )
    .setColor(0xf04747);

  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  // Add "Contact Developer" button if a support URL is configured
  if (context.config.supportUrl) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Contact Developer")
        .setStyle(ButtonStyle.Link)
        .setURL(context.config.supportUrl)
    );
    components.push(row);
  }

  const response = { embeds: [embed], components, ephemeral: true };

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(response);
    } else {
      await interaction.reply(response);
    }
  } catch (replyError) {
    context.logger.error("Failed to send error response to user", replyError);
  }
};
