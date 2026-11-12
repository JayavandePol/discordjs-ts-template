import {
  Events,
  Interaction,
  MessageFlags,
  type ChatInputCommandInteraction,
  type MessageContextMenuCommandInteraction,
  type UserContextMenuCommandInteraction,
} from "discord.js";
import { defineEvent } from "../types/Event.js";
import { checkAccess, type AccessTarget } from "../core/access.js";
import { Command, commandKey } from "../types/Command.js";
import { BotContext } from "../types/Context.js";
import { handleInteractionError } from "../utils/error-handler.js";
import { RepliableInteraction, sendEphemeral } from "../utils/reply.js";

type CommandInteraction =
  | ChatInputCommandInteraction
  | UserContextMenuCommandInteraction
  | MessageContextMenuCommandInteraction;

const EXPIRED_COMPONENT = "This button or menu is no longer active.";

// Runs the shared access check and tells the user when they are denied
const ensureAccess = async (target: AccessTarget, interaction: RepliableInteraction, context: BotContext) => {
  const result = checkAccess(target, interaction, context.config);
  if (result.allowed) return true;

  context.logger.warn("Access denied", {
    user: interaction.user.id,
    target: "commandName" in interaction ? interaction.commandName : "customId" in interaction ? interaction.customId : undefined,
  });
  await sendEphemeral(interaction, { content: result.reason });
  return false;
};

// ------------------------------------------------------------------
// Components: buttons, select menus and modals
// ------------------------------------------------------------------
const handleComponent = async (interaction: Interaction, context: BotContext) => {
  const { components, logger } = context;

  if (interaction.isButton()) {
    if (components.isCollectorOwned(interaction.customId)) return; // handled by a message collector
    const handler = components.findButton(interaction.customId);
    if (!handler) {
      logger.debug("No handler for button", { customId: interaction.customId });
      await sendEphemeral(interaction, { content: EXPIRED_COMPONENT });
      return;
    }
    if (!(await ensureAccess(handler, interaction, context))) return;
    await handler.execute(interaction, context);
    return;
  }

  if (interaction.isAnySelectMenu()) {
    if (components.isCollectorOwned(interaction.customId)) return;
    const handler = components.findSelectMenu(interaction.customId);
    if (!handler) {
      await sendEphemeral(interaction, { content: EXPIRED_COMPONENT });
      return;
    }
    if (!(await ensureAccess(handler, interaction, context))) return;
    await handler.execute(interaction, context);
    return;
  }

  if (interaction.isModalSubmit()) {
    const handler = components.findModal(interaction.customId);
    if (!handler) {
      await sendEphemeral(interaction, { content: EXPIRED_COMPONENT });
      return;
    }
    if (!(await ensureAccess(handler, interaction, context))) return;
    await handler.execute(interaction, context);
  }
};

// ------------------------------------------------------------------
// Slash commands and context menus
// ------------------------------------------------------------------
const runCommand = async (command: Command, interaction: CommandInteraction, context: BotContext) => {
  if (command.kind === "slash" && interaction.isChatInputCommand()) return command.execute(interaction, context);
  if (command.kind === "user" && interaction.isUserContextMenuCommand()) return command.execute(interaction, context);
  if (command.kind === "message" && interaction.isMessageContextMenuCommand()) return command.execute(interaction, context);
  throw new Error(`Command "${command.data.name}" (${command.kind}) received a mismatched interaction.`);
};

const handleCommand = async (interaction: CommandInteraction, context: BotContext) => {
  const { commands, logger, cooldowns } = context;
  const kind = interaction.isChatInputCommand() ? "slash" : interaction.isUserContextMenuCommand() ? "user" : "message";
  const command = commands.get(commandKey(kind, interaction.commandName));

  if (!command) {
    logger.warn("Received unknown command", { command: interaction.commandName, kind });
    await sendEphemeral(interaction, { content: "Command not recognized." });
    return;
  }

  if (!(await ensureAccess(command, interaction, context))) return;

  if (command.cooldown) {
    const remaining = cooldowns.check(command.data.name, interaction.user.id, command.cooldown);
    if (remaining !== null) {
      await sendEphemeral(interaction, {
        content: `⏳ Please wait **${remaining}s** before using \`${command.data.name}\` again.`,
      });
      return;
    }
  }

  // Deferring buys 15 minutes instead of 3 seconds for the first response
  if (command.defer) {
    await interaction.deferReply(command.defer === "ephemeral" ? { flags: MessageFlags.Ephemeral } : {});
  }

  await runCommand(command, interaction, context);
};

/**
 * Routes every interaction. The whole route runs inside one error boundary: any failure,
 * including a failed reply or deferReply (e.g. 10062 Unknown interaction), ends up in
 * handleInteractionError instead of escaping the listener.
 */
const event = defineEvent({
  name: Events.InteractionCreate,
  async execute(interaction, context) {
    if (interaction.isAutocomplete()) {
      const command = context.commands.get(commandKey("slash", interaction.commandName));
      if (command?.kind !== "slash" || !command.autocomplete) return;

      // Autocomplete can leak data (e.g. error IDs), so it gets the same access check as the command
      if (!checkAccess(command, interaction, context.config).allowed) {
        await interaction.respond([]).catch(() => undefined);
        return;
      }

      try {
        await command.autocomplete(interaction, context);
      } catch (error) {
        context.logger.error("Autocomplete handler failed", { command: interaction.commandName, err: error });
        if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
      }
      return;
    }

    if (!interaction.isRepliable()) return;

    const label = interaction.isCommand()
      ? `command:${interaction.commandName}`
      : "customId" in interaction
        ? `component:${interaction.customId}`
        : "interaction";

    try {
      if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        await handleCommand(interaction, context);
      } else {
        await handleComponent(interaction, context);
      }
    } catch (error) {
      await handleInteractionError(interaction, context, error, label);
    }
  },
});

export default event;
