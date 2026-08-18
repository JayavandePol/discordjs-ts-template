import {
  ButtonInteraction,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import { BotContext } from "./Context.js";

/**
 * Handler definition for Button interactions.
 * `customId` can be an exact string (e.g. "ticket:close") or a RegExp (e.g. /^ticket:close:.+$/).
 */
export interface ButtonHandler {
  customId: string | RegExp;
  execute: (interaction: ButtonInteraction, context: BotContext) => Promise<void>;
}

/**
 * Handler definition for Select Menu (String, User, Role, Channel, Mentionable) interactions.
 */
export interface SelectMenuHandler {
  customId: string | RegExp;
  execute: (interaction: AnySelectMenuInteraction, context: BotContext) => Promise<void>;
}

/**
 * Handler definition for Modal submission interactions.
 */
export interface ModalHandler {
  customId: string | RegExp;
  execute: (interaction: ModalSubmitInteraction, context: BotContext) => Promise<void>;
}

export type ComponentCollections = {
  buttons: ButtonHandler[];
  selectMenus: SelectMenuHandler[];
  modals: ModalHandler[];
};
