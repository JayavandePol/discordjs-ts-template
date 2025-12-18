import fs from "node:fs/promises";
import path from "node:path";
import { Client } from "discord.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Event } from "../types/Event.js";
import { BotContext } from "../types/Context.js";
import { Logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isEventFile = (file: string) =>
  (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts");

const collectFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile() && isEventFile(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

export const registerEvents = async (
  client: Client,
  context: BotContext,
  logger: Logger
): Promise<void> => {
  const eventsPath = path.resolve(__dirname, "../events");
  const files = await collectFiles(eventsPath);

  for (const file of files) {
    const rel = path.relative(eventsPath, file);
    const url = pathToFileURL(file).href;
    const module = await import(url);
    const event: Event | undefined = module.default;
    if (!event) {
      logger.warn("Skipped event without default export", { file: rel });
      continue;
    }

    const handler = (...args: unknown[]) => event.execute(...(args as []), context);
    if (event.once) {
      client.once(event.name, handler);
    } else {
      client.on(event.name, handler);
    }

    logger.debug("Registered event", { name: event.name, file: rel });
  }
};
