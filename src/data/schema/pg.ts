import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { ErrorMeta } from "../../types/ErrorMeta.js";

/**
 * One row per error occurrence. `id` is the random report ID shown to the user;
 * `fingerprint` groups occurrences of the same bug.
 */
export const errorEvents = pgTable(
  "error_events",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),

    // Where it happened, e.g. "command:ping" or "component:error:info:abc"
    context: text("context").notNull(),

    name: text("name"),
    message: text("message").notNull(),
    stack: text("stack"),

    guildId: text("guild_id"),
    userId: text("user_id"),
    channelId: text("channel_id"),
    command: text("command"),
    meta: jsonb("meta").$type<ErrorMeta>(),
  },
  (table) => [
    index("error_events_fingerprint_idx").on(table.fingerprint),
    index("error_events_created_at_idx").on(table.createdAt),
  ]
);
