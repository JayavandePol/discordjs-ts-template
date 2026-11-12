import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  CommandInteractionOption,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { BotContext } from "../types/Context.js";
import { ErrorMeta } from "../types/ErrorMeta.js";
import { captureError } from "./error-reporter.js";
import { notifyErrorLogChannel } from "./error-log.js";
import { EmbedColors } from "./embeds.js";
import { RepliableInteraction, sendEphemeral } from "./reply.js";
import { UserError } from "./user-error.js";

export type { RepliableInteraction } from "./reply.js";

const isUserError = (error: unknown): error is UserError =>
  error instanceof UserError || (error instanceof Error && error.name === "UserError");

// Collects option names (never values), including options nested in subcommands
const collectOptionNames = (options: readonly CommandInteractionOption[]): string[] =>
  options.flatMap((option) =>
    option.type === ApplicationCommandOptionType.Subcommand || option.type === ApplicationCommandOptionType.SubcommandGroup
      ? collectOptionNames(option.options ?? [])
      : [option.name]
  );

const buildMeta = (interaction: RepliableInteraction): ErrorMeta => {
  const meta: ErrorMeta = {
    userId: interaction.user.id,
    guildId: interaction.guildId ?? undefined,
    channelId: interaction.channelId ?? undefined,
  };

  if (interaction.isChatInputCommand()) {
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(false);
    const optionNames = collectOptionNames(interaction.options.data);
    meta.command = interaction.commandName;
    meta.subcommand = [group, subcommand].filter(Boolean).join(" ") || undefined;
    meta.optionNames = optionNames.length > 0 ? optionNames : undefined;
  } else if (interaction.isCommand()) {
    meta.command = interaction.commandName;
  } else {
    // Buttons, select menus and modals: the customId says what was used; modal text is never stored
    meta.command = interaction.customId;
  }

  return meta;
};

/**
 * Central error handler for every interaction type.
 *
 * - UserError: the message is shown to the user as a notice; nothing is logged as a crash.
 * - Anything else: logged, stored, posted to the error log channel, and the user gets an error ID.
 *
 * Each stage is best-effort and this function never throws, so a broken database, log channel
 * or SUPPORT_URL can't turn one failed command into a crashed bot.
 */
export const handleInteractionError = async (
  interaction: RepliableInteraction,
  context: BotContext,
  error: unknown,
  contextLabel: string,
  meta?: ErrorMeta
): Promise<void> => {
  const { logger } = context;

  try {
    if (isUserError(error)) {
      const embed = new EmbedBuilder().setTitle("Notice").setDescription(error.message).setColor(EmbedColors.Warning);
      await sendEphemeral(interaction, { embeds: [embed] }).catch((replyError: unknown) =>
        logger.error("Failed to send UserError response", replyError)
      );
      return;
    }

    const errorMeta = meta ?? buildMeta(interaction);
    const report = await captureError(logger, error, contextLabel, context.errorStore, errorMeta);

    await notifyErrorLogChannel(context, { report, meta: errorMeta, contextLabel }).catch((notifyError: unknown) =>
      logger.error("Failed to notify error log channel", notifyError)
    );

    const embed = new EmbedBuilder()
      .setTitle("Something went wrong")
      .setDescription(
        "We ran into an unexpected error while handling your request. " +
          "Please contact the developers and share this error ID so we can investigate.\n\n" +
          `Error ID: **${report.id}**`
      )
      .setColor(EmbedColors.Error);

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    if (context.config.supportUrl) {
      try {
        components.push(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setLabel("Contact Developer").setStyle(ButtonStyle.Link).setURL(context.config.supportUrl)
          )
        );
      } catch (buttonError) {
        logger.warn("SUPPORT_URL is not a valid link button URL; sending the error without it", buttonError);
      }
    }

    await sendEphemeral(interaction, { embeds: [embed], components }).catch((replyError: unknown) =>
      logger.error("Failed to send error response to user", replyError)
    );
  } catch (handlerError) {
    logger.error("Error handler failed", { err: handlerError, original: error, contextLabel });
  }
};
