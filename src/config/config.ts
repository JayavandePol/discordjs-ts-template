import "dotenv/config";
import { z } from "zod";

// Helper schema for boolean coercion from flexible environment string values (e.g., "true", "1", "yes")
const booleanString = (defaultValue = false) =>
  z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return defaultValue;
      return ["1", "true", "yes", "y", "on"].includes(val.toLowerCase().trim());
    });

// Define the complete environment variable validation schema using Zod
const envSchema = z.object({
  // Discord Bot Authentication Token (Required)
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required to authenticate with Discord."),

  // Discord Application / Client ID (Required)
  APPLICATION_ID: z.string().min(1, "APPLICATION_ID is required for slash command registration."),

  // Target Guild ID for development / testing (Optional)
  GUILD_ID: z.string().optional(),

  // Logging level verbosity (Optional, defaults to 'info')
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Developer User IDs (comma-separated or single snowflake, e.g. "12345,67890")
  DEV_USER_IDS: z.string().optional(),

  // Legacy DEV_ID environment variable (can be a user ID or a guild role ID)
  DEV_ID: z.string().optional(),

  // Developer Role ID in a guild (Optional)
  DEV_ROLE_ID: z.string().optional(),

  // Whether the bot should register commands globally across all guilds (Defaults to false)
  MULTI_GUILD: booleanString(false),

  // Channel ID where uncaught error alerts and stack traces should be sent
  ERRORLOGCHANNEL_ID: z.string().optional(),

  // Support server / issue tracker URL shown in user-facing error embeds
  SUPPORT_URL: z.string().url().optional().or(z.literal("")),

  // Guard flag to control whether slash commands are auto-deployed on bot startup.
  // Kept false by default to prevent hitting Discord API rate limits during local hot-reloading.
  AUTO_REGISTER_COMMANDS: booleanString(false),

  // Database Connection URL (e.g. "file:./data/database.sqlite" or "postgresql://...")
  DATABASE_URL: z.string().optional(),

  // SQLite database file path fallback
  DB_STORAGE: z.string().default("./data/database.sqlite"),

  // Explicit flag to enable/disable database integration
  DB_ENABLED: z.string().optional(),

  // Whether database query logging is enabled
  DB_LOGGING: booleanString(false),
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
    url?: string;
    storage: string;
    logging: boolean;
  };
};

/**
 * Loads and validates environment variables using Zod schema.
 * Throws human-readable error messages if required configuration is missing.
 */
export const loadConfig = (): Config => {
  // Validate process.env against schema
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Format descriptive error output for each missing or invalid configuration key
    const errors = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`\n[Config Error] Invalid environment configuration:\n${errors}\n`);
  }

  const env = parsed.data;

  // Aggregate developer user IDs from DEV_USER_IDS and DEV_ID
  const devUserIds: string[] = [];
  if (env.DEV_USER_IDS) {
    devUserIds.push(...env.DEV_USER_IDS.split(",").map((id) => id.trim()).filter(Boolean));
  }
  if (env.DEV_ID && !devUserIds.includes(env.DEV_ID.trim())) {
    devUserIds.push(env.DEV_ID.trim());
  }

  // Developer role ID can be explicitly set or fallback to DEV_ID
  const devRoleId = env.DEV_ROLE_ID || env.DEV_ID;

  // Determine if database should be enabled
  const dbEnabled =
    env.DB_ENABLED !== undefined
      ? ["1", "true", "yes", "y", "on"].includes(env.DB_ENABLED.toLowerCase().trim())
      : Boolean(env.DATABASE_URL || env.DB_STORAGE);

  return {
    token: env.DISCORD_TOKEN,
    applicationId: env.APPLICATION_ID,
    guildId: env.GUILD_ID || undefined,
    logLevel: env.LOG_LEVEL,
    devUserIds,
    devRoleId: devRoleId || undefined,
    multiGuild: env.MULTI_GUILD,
    errorLogChannelId: env.ERRORLOGCHANNEL_ID || undefined,
    supportUrl: env.SUPPORT_URL || undefined,
    autoRegisterCommands: env.AUTO_REGISTER_COMMANDS,
    database: {
      enabled: dbEnabled,
      url: env.DATABASE_URL,
      storage: env.DB_STORAGE,
      logging: env.DB_LOGGING,
    },
  };
};
