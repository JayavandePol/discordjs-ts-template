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
 * One-call error handler for ANY interaction type.
 *
 * Captures the error, logs it to DB, notifies the error log channel,
 * and replies to the user with a friendly embed + "Contact Developer" button.
 *
 * Works with slash commands, buttons, select menus, modals — anything repliable.
 *
 * **Most commands don't need this** — the central handler in interactionCreate.ts
 * already catches all unhandled errors from slash commands automatically.
 *
 * Use this when:
 * - A button/select menu/modal handler needs error handling
 * - A command needs partial-failure handling (catch, report, continue)
 *
 * @example
 * ```ts
 * // In a slash command
 * try { ... } catch (error) {
 *   await handleInteractionError(interaction, context, error, "command:pay");
 * }
 *
 * // In a button handler
 * try { ... } catch (error) {
 *   await handleInteractionError(interaction, context, error, "button:confirm-purchase");
 * }
 * ```
 */
export const handleInteractionError = async (
    interaction: RepliableInteraction,
    context: BotContext,
    error: unknown,
    contextLabel: string,
    meta?: ErrorMeta
): Promise<void> => {
    const options: Record<string, string | number | boolean> = {};

    if (interaction.isChatInputCommand() && interaction.options.data) {
        for (const opt of interaction.options.data) {
            if (opt.value !== undefined) {
                options[opt.name] = opt.value;
            }
        }
    } else if (interaction.isModalSubmit()) {
        for (const [key, field] of interaction.fields.fields) {
            if ("value" in field) {
                options[key] = field.value;
            }
        }
    }

    const errorMeta: ErrorMeta = meta ?? {
        userId: interaction.user.id,
        guildId: interaction.guildId ?? undefined,
        channelId: interaction.channelId ?? undefined,
        command: "commandName" in interaction ? interaction.commandName : undefined,
        options: Object.keys(options).length > 0 ? options : undefined,
    };

    if (error && typeof error === "object" && "name" in error && error.name === "UserError") {
        const message = "message" in error ? String(error.message) : "An expected error occurred.";

        const response = {
            embeds: [new EmbedBuilder().setTitle("Notice").setDescription(message).setColor(0xeeb902)],
            ephemeral: true
        };

        try {
            if (interaction.deferred || interaction.replied) await interaction.editReply(response);
            else await interaction.reply(response);
        } catch (replyError) {
            context.logger.error("Failed to send UserError response", replyError);
        }
        return;
    }

    const report = await captureError(
        context.logger,
        error,
        contextLabel,
        context.errorStore,
        errorMeta
    );

    await notifyErrorLogChannel(context, {
        report,
        meta: errorMeta,
        contextLabel,
    });

    const embed = new EmbedBuilder()
        .setTitle("Something went wrong")
        .setDescription(
            "We ran into an unexpected error while handling your request. " +
            "Please contact the developers and share this error ID so we can investigate.\n\n" +
            `Error ID: **${report.id}**`
        )
        .setColor(0xf04747);

    const components: ActionRowBuilder<ButtonBuilder>[] = [];

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
