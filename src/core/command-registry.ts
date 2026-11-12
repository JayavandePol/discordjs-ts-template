import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, CommandKind, commandKey } from "../types/Command.js";
import { Logger } from "../utils/logger.js";
import { isObject, loadModules } from "./module-loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMMAND_KINDS: CommandKind[] = ["slash", "user", "message"];

const isCommand = (value: unknown): value is Command =>
  isObject(value) &&
  COMMAND_KINDS.includes(value.kind as CommandKind) &&
  typeof value.execute === "function" &&
  isObject(value.data) &&
  typeof value.data.name === "string" &&
  typeof value.data.toJSON === "function";

// Derive default access level from directory structure (e.g., commands/developer/* => "developer")
const deriveAccess = (file: string): Command["access"] => {
  const segments = file.split("/");
  if (segments.includes("developer")) return "developer";
  if (segments.includes("administrator")) return "admin";
  return "public";
};

/**
 * Loads every command in src/commands, keyed by `${kind}:${name}`.
 * Throws on malformed modules and on duplicate names of the same kind.
 */
export const loadCommands = async (
  logger: Logger,
  commandsPath = path.resolve(__dirname, "../commands")
): Promise<Map<string, Command>> => {
  const commands = new Map<string, Command>();

  for (const { file, value: command } of await loadModules(commandsPath, isCommand, "command")) {
    const key = commandKey(command.kind, command.data.name);
    if (commands.has(key)) {
      throw new Error(`Duplicate ${command.kind} command "${command.data.name}" in "${file}".`);
    }

    command.access = command.access ?? deriveAccess(file);
    commands.set(key, command);
    logger.debug("Loaded command", { key, file, access: command.access });
  }

  return commands;
};
