import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { loadCommands } from "../core/command-registry.js";
import { loadConfig } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import { clearApplicationCommands, registerApplicationCommands } from "../core/command-publisher.js";

const USAGE = "Usage: register-commands --scope <guild|global> [--clear]";

/**
 * Parses CLI arguments. The scope is required and validated: a typo must never fall
 * through to replacing the global command list.
 */
export const parseRegisterArgs = (argv: string[]) => {
  const { values } = parseArgs({
    args: argv,
    options: { scope: { type: "string" }, clear: { type: "boolean", default: false } },
    strict: true,
  });

  const scope = z.enum(["guild", "global"]).safeParse(values.scope);
  if (!scope.success) {
    throw new Error(`Invalid or missing --scope "${values.scope ?? ""}". ${USAGE}`);
  }
  return { scope: scope.data, clear: values.clear ?? false };
};

const main = async () => {
  const { scope, clear } = parseRegisterArgs(process.argv.slice(2));
  const config = loadConfig();
  const logger = new Logger(config.logLevel);

  if (clear) {
    await clearApplicationCommands(config, logger, scope);
  } else {
    await registerApplicationCommands(await loadCommands(logger), config, logger, scope);
  }
  await logger.flush();
};

// Only run when executed directly, so tests can import parseRegisterArgs
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
