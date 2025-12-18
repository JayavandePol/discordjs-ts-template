import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "../types/Command.js";
import { Logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCommandFile = (file: string) =>
  (file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts");

const collectFiles = async (dir: string): Promise<string[]> => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile() && isCommandFile(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
};

const deriveAccess = (relativePath: string): Command["access"] => {
  const segments = relativePath.split(path.sep);
  if (segments.includes("developer")) return "developer";
  if (segments.includes("administrator")) return "admin";
  return "public";
};

export const loadCommands = async (logger: Logger): Promise<Map<string, Command>> => {
  const commands = new Map<string, Command>();
  const commandsPath = path.resolve(__dirname, "../commands");
  const files = await collectFiles(commandsPath);

  for (const file of files) {
    const rel = path.relative(commandsPath, file);
    const url = pathToFileURL(file).href;
    const module = await import(url);
    const command: Command | undefined = module.default;
    if (!command) {
      logger.warn("Skipped command without default export", { file: rel });
      continue;
    }
    const derivedAccess = deriveAccess(rel);
    command.access = command.access ?? derivedAccess;
    command.devOnly = command.devOnly ?? command.access === "developer";
    commands.set(command.data.name, command);
    logger.debug("Loaded command", { name: command.data.name, file: rel, access: command.access });
  }

  return commands;
};
