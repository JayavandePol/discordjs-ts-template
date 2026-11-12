import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Command, type CommandKind, commandKey } from "../types/Command.js";
import type { Logger } from "../utils/logger.js";
import { resolveAccess } from "./access.js";
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

    command.access = resolveAccess(file, command.access);
    commands.set(key, command);
    logger.debug("Loaded command", { key, file, access: command.access });
  }

  return commands;
};
