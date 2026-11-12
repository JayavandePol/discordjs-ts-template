import type {
  AnySelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import type { AccessLevel } from "./Command.js";
import type { BotContext } from "./Context.js";

/**
 * `customId` is an exact string (e.g. "ticket:close") or a RegExp (e.g. /^ticket:close:.+$/).
 * customIds starting with "collector:" are reserved for message collectors (see utils/paginator.ts)
 * and are never routed to a handler.
 */
type ComponentBase<I> = {
  customId: string | RegExp;
  // Defaults to "public". Checked before execute() with the same rules as commands.
  access?: AccessLevel;
  execute: (interaction: I, context: BotContext) => Promise<void>;
};

export type ButtonHandler = ComponentBase<ButtonInteraction>;
export type SelectMenuHandler = ComponentBase<AnySelectMenuInteraction>;
export type ModalHandler = ComponentBase<ModalSubmitInteraction>;

export const COLLECTOR_PREFIX = "collector:";

export const defineButton = (handler: ButtonHandler) => handler;
export const defineSelectMenu = (handler: SelectMenuHandler) => handler;
export const defineModal = (handler: ModalHandler) => handler;
