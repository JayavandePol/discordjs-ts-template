import "dotenv/config";
import { z } from "zod";
import { resolveDatabase, type DatabaseTarget } from "../data/database-url.js";

// Unset and blank values (`GUILD_ID=`) are both treated as "not configured"
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), schema.optional());

// Discord IDs (snowflakes) are 17-20 digit numbers
const snowflake = z.string().trim().regex(/^\d{17,20}$/, "must be a Discord ID (17-20 digits)");

const snowflakeList = z
  .string()
  .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
  .pipe(z.array(snowflake));

// "true"/"false", "1"/"0", "yes"/"no", "on"/"off"; anything else (e.g. "ture") is rejected
const flag = (defaultValue: boolean) => optional(z.stringbool()).transform((value) => value ?? defaultValue);

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "is required to log in to Discord"),
  APPLICATION_ID: snowflake,
  GUILD_ID: optional(snowflake),
  LOG_LEVEL: optional(z.enum(["debug", "info", "warn", "error"])).transform((value) => value ?? "info"),

  DEV_USER_IDS: optional(snowflakeList).transform((value) => value ?? []),
  DEV_ROLE_ID: optional(snowflake),

  MULTI_GUILD: flag(false),
  AUTO_REGISTER_COMMANDS: flag(false),

  ERRORLOGCHANNEL_ID: optional(snowflake),
  // Link buttons only accept http(s) URLs; anything else would break every error reply
  SUPPORT_URL: optional(z.url({ protocol: /^https?$/, error: "must be an http(s) URL" })),

  DB_ENABLED: flag(true),
  DATABASE_URL: optional(z.string()),
  // Only for remote libSQL / Turso databases
  DATABASE_AUTH_TOKEN: optional(z.string()),
  DB_LOGGING: flag(false),
});

export type Config = {
  token: string;
  applicationId: string;
  guildId?: string;
  logLevel: "debug" | "info" | "warn" | "error";
  devUserIds: string[];
  devRoleId?: string;
  multiGuild: boolean;
  errorLogChannelId?: string;
  supportUrl?: string;
  autoRegisterCommands: boolean;
  database: {
    enabled: boolean;
    target: DatabaseTarget;
    authToken?: string;
    logging: boolean;
  };
};

/**
 * Loads and validates environment variables. Throws one readable error listing every
 * invalid or missing setting.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  if (env.DEV_ID) {
    throw new Error("\n[Config Error] DEV_ID was removed. Use DEV_USER_IDS (user IDs) or DEV_ROLE_ID (a role).\n");
  }

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`\n[Config Error] Invalid environment configuration:\n${errors}\n`);
  }

  const values = parsed.data;

  let target: DatabaseTarget;
  try {
    target = resolveDatabase(values.DATABASE_URL);
  } catch (error) {
    throw new Error(`\n[Config Error] Invalid environment configuration:\n  - DATABASE_URL: ${(error as Error).message}\n`);
  }

  return {
    token: values.DISCORD_TOKEN,
    applicationId: values.APPLICATION_ID,
    guildId: values.GUILD_ID,
    logLevel: values.LOG_LEVEL,
    devUserIds: values.DEV_USER_IDS,
    devRoleId: values.DEV_ROLE_ID,
    multiGuild: values.MULTI_GUILD,
    errorLogChannelId: values.ERRORLOGCHANNEL_ID,
    supportUrl: values.SUPPORT_URL,
    autoRegisterCommands: values.AUTO_REGISTER_COMMANDS,
    database: {
      enabled: values.DB_ENABLED,
      target,
      authToken: values.DATABASE_AUTH_TOKEN,
      logging: values.DB_LOGGING,
    },
  };
};
