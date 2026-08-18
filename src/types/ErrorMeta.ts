// Metadata payload attached to error reports for contextual tracing
export type ErrorMeta = {
  // Discord snowflake of the executing user
  userId?: string;

  // Discord snowflake of the guild where the interaction occurred
  guildId?: string;

  // Discord snowflake of the channel where the interaction occurred
  channelId?: string;

  // Name of the slash command or custom ID of the interaction component
  command?: string;

  // Key-value map of user-supplied slash command or modal inputs
  options?: Record<string, string | number | boolean>;

  // Flexible additional key-value metadata
  [key: string]: unknown;
};
