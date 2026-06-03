import "dotenv/config";

export type Config = {
  token: string;
  applicationId: string;
  guildId?: string;
  logLevel: "debug" | "info" | "warn" | "error";
  devId?: string;
  multiGuild: boolean;
  errorLogChannelId?: string;
  supportUrl?: string;
  database: {
    enabled: boolean;
    url?: string;
    storage?: string;
    logging: boolean;
  };
};

const required = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const boolFromString = (value: string | undefined, fallback = false): boolean => {
  if (typeof value !== "string") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase().trim());
};

export const loadConfig = (): Config => {
  const databaseUrl = process.env.DATABASE_URL;
  const dbEnabledEnv = process.env.DB_ENABLED;
  const dbEnabled =
    dbEnabledEnv !== undefined
      ? boolFromString(dbEnabledEnv, true)
      : Boolean(databaseUrl || process.env.DB_STORAGE);

  return {
    token: required(process.env.DISCORD_TOKEN, "DISCORD_TOKEN"),
    applicationId: required(process.env.APPLICATION_ID, "APPLICATION_ID"),
    guildId: process.env.GUILD_ID,
    logLevel: (process.env.LOG_LEVEL as Config["logLevel"]) ?? "info",
    devId: process.env.DEV_ID,
    multiGuild: boolFromString(process.env.MULTI_GUILD),
    errorLogChannelId: process.env.ERRORLOGCHANNEL_ID,
    supportUrl: process.env.SUPPORT_URL,
    database: {
      enabled: dbEnabled,
      url: databaseUrl,
      storage: process.env.DB_STORAGE ?? "./data/database.sqlite",
      logging: boolFromString(process.env.DB_LOGGING),
    },
  };
};
