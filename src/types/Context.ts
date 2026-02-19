import { Client } from "discord.js";
import { Config } from "../config/config.js";
import { Logger } from "../utils/logger.js";
import { Command } from "./Command.js";
import { ErrorStore } from "../data/error-store.js";

export interface BotContext {
  client: Client;
  logger: Logger;
  config: Config;
  commands: Map<string, Command>;
  errorStore?: ErrorStore;
}
