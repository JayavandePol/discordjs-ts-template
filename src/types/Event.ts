import { ClientEvents } from "discord.js";
import { BotContext } from "./Context.js";

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
  name: K;
  once?: boolean;
  execute: (...args: [...ClientEvents[K], BotContext]) => Promise<void>;
}
