import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// SQLite schema definition for the errors table
export const sqliteErrors = sqliteTable("errors", {
  // Unique 8-character error hash ID (Primary Key)
  id: text("id").primaryKey(),

  // ISO timestamp when the error occurred
  timestamp: text("timestamp").notNull(),

  // Severity classification (default: "error")
  severity: text("severity").notNull().default("error"),

  // Context label (e.g. "command:ping", "event:ready")
  context: text("context").notNull(),

  // Error class name (e.g. "TypeError", "DiscordAPIError")
  name: text("name"),

  // Error message string
  message: text("message").notNull(),

  // Sanitized stack trace
  stack: text("stack"),

  // Discord Guild snowflake (if applicable)
  guildId: text("guild_id"),

  // Discord User snowflake (if applicable)
  userId: text("user_id"),

  // Command name or custom ID
  command: text("command"),

  // Structured metadata snapshot (options, fields) parsed as JSON
  meta: text("meta", { mode: "json" }),

  // Number of times this exact error signature has been observed
  occurrences: integer("occurrences").notNull().default(1),
});
