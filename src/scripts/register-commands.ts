import { loadCommands } from "../core/command-registry.js";
import { loadConfig } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import {
  registerApplicationCommands,
  RegistrationScope,
} from "../core/command-publisher.js";

type ScopeArg = RegistrationScope | "auto";

const parseScope = (): ScopeArg => {
  const arg = process.argv.find((part) => part === "--scope" || part.startsWith("--scope="));
  if (!arg) return "auto";
  if (arg === "--scope") {
    const value = process.argv[process.argv.indexOf(arg) + 1];
    return (value as ScopeArg) ?? "auto";
  }
  const [, value] = arg.split("=");
  return (value as ScopeArg) ?? "auto";
};

const config = loadConfig();
const logger = new Logger(config.logLevel);
const scope = parseScope();

const commands = await loadCommands(logger);

const override = scope === "auto" ? undefined : scope;

try {
  await registerApplicationCommands(commands, config, logger, override);
} catch (error) {
  logger.error("Failed to register commands", error);
  process.exitCode = 1;
}
