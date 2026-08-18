import { mysqlTable, varchar, text, int, json } from "drizzle-orm/mysql-core";

// MySQL & MariaDB schema definition for the errors table
export const mysqlErrors = mysqlTable("errors", {
  // Unique 8-character error hash ID (Primary Key)
  id: varchar("id", { length: 64 }).primaryKey(),

  // ISO timestamp string when the error occurred
  timestamp: varchar("timestamp", { length: 64 }).notNull(),

  // Severity classification (default: "error")
  severity: varchar("severity", { length: 32 }).notNull().default("error"),

  // Context label (e.g. "command:ping", "event:ready")
  context: varchar("context", { length: 255 }).notNull(),

  // Error class name (e.g. "TypeError", "DiscordAPIError")
  name: varchar("name", { length: 255 }),

  // Error message text
  message: text("message").notNull(),

  // Sanitized stack trace
  stack: text("stack"),

  // Discord Guild snowflake (if applicable)
  guildId: varchar("guild_id", { length: 64 }),

  // Discord User snowflake (if applicable)
  userId: varchar("user_id", { length: 64 }),

  // Command name or custom ID
  command: varchar("command", { length: 255 }),

  // Structured JSON metadata snapshot
  meta: json("meta"),

  // Number of times this exact error signature has been observed
  occurrences: int("occurrences").notNull().default(1),
});
