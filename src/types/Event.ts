import { ClientEvents } from "discord.js";
import { BotContext } from "./Context.js";

/**
 * Interface representing an event listener module in the bot framework.
 */
export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  // Name of the Discord gateway event (e.g. Events.ClientReady, Events.InteractionCreate)
  name: K;

  // Whether this event should only fire once (client.once)
  once?: boolean;

  // Handler invoked when the event is emitted, receiving event arguments followed by BotContext
  execute: (...args: [...ClientEvents[K], BotContext]) => Promise<void>;
}
