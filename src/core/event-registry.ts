import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "discord.js";
import { Event } from "../types/Event.js";
import { BotContext } from "../types/Context.js";
import { Logger } from "../utils/logger.js";
import { isObject, loadModules } from "./module-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isEvent = (value: unknown): value is Event =>
  isObject(value) && typeof value.name === "string" && typeof value.execute === "function";

/**
 * Loads every event module in src/events and attaches it to the client.
 */
export const registerEvents = async (
  client: Client,
  context: BotContext,
  logger: Logger,
  eventsPath = path.resolve(__dirname, "../events")
): Promise<void> => {
  for (const { file, value: event } of await loadModules(eventsPath, isEvent, "event")) {
    // Event<K>.execute is typed per event; at this boundary the arguments come straight from discord.js
    const execute = event.execute as (...args: unknown[]) => Promise<void>;
    // discord.js re-emits rejected listeners as a client "error" event; catching here keeps the
    // event name in the log and guarantees a failing listener never reaches the process handlers
    const handler = async (...args: unknown[]) => {
      try {
        await execute(...args, context);
      } catch (error) {
        logger.error("Event handler failed", { event: event.name, file, err: error });
      }
    };

    if (event.once) client.once(event.name, handler);
    else client.on(event.name, handler);

    logger.debug("Registered event", { name: event.name, file });
  }
};
