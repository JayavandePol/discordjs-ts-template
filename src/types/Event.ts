import type { ClientEvents } from "discord.js";
import type { BotContext } from "./Context.js";

/**
 * An event listener module. Exceptions thrown from `execute` are caught and logged by the
 * event registry, so a failing listener never takes the process down.
 */
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (...args: [...ClientEvents[K], BotContext]) => Promise<void>;
}

/** Defines an event listener with the argument types inferred from the event name. */
export const defineEvent = <K extends keyof ClientEvents>(event: Event<K>): Event<K> => event;
