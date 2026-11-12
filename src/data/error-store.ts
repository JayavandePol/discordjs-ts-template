import { desc, eq, like, lt, or, sql } from "drizzle-orm";
import type { DatabaseConnection } from "./db.js";
import { errorEvents as sqliteEvents } from "./schema/sqlite.js";
import { errorEvents as pgEvents } from "./schema/pg.js";
import type { ErrorMeta } from "../types/ErrorMeta.js";

export type ErrorEventInput = {
  id: string;
  fingerprint: string;
  context: string;
  name?: string;
  message: string;
  stack?: string;
  meta?: ErrorMeta;
  createdAt?: Date;
};

export type ErrorEvent = Required<Pick<ErrorEventInput, "id" | "fingerprint" | "context" | "message">> & {
  name?: string;
  stack?: string;
  meta?: ErrorMeta;
  createdAt: Date;
  // How often this fingerprint (the same bug) has been seen in total
  occurrences: number;
};

/**
 * Stores error reports. Every occurrence is its own row with a random ID (what users quote);
 * rows with the same fingerprint are the same bug.
 */
export interface ErrorStore {
  record(event: ErrorEventInput): Promise<void>;
  getById(id: string): Promise<ErrorEvent | null>;
  listLatest(limit: number): Promise<ErrorEvent[]>;
  // Matches the start of an ID or any part of the context label (for autocomplete)
  search(query: string, limit: number): Promise<ErrorEvent[]>;
  // Deletes reports created before `cutoff`; returns how many were removed
  prune(cutoff: Date): Promise<number>;
}

type Row = {
  id: string;
  fingerprint: string;
  createdAt: Date;
  context: string;
  name: string | null;
  message: string;
  stack: string | null;
  meta: ErrorMeta | null;
  occurrences: number;
};

const toEvent = (row: Row): ErrorEvent => ({
  id: row.id,
  fingerprint: row.fingerprint,
  createdAt: row.createdAt,
  context: row.context,
  name: row.name ?? undefined,
  message: row.message,
  stack: row.stack ?? undefined,
  meta: row.meta ?? undefined,
  occurrences: row.occurrences,
});

const toValues = (event: ErrorEventInput) => ({
  id: event.id,
  fingerprint: event.fingerprint,
  createdAt: event.createdAt ?? new Date(),
  context: event.context,
  name: event.name ?? null,
  message: event.message,
  stack: event.stack ?? null,
  guildId: event.meta?.guildId ?? null,
  userId: event.meta?.userId ?? null,
  channelId: event.meta?.channelId ?? null,
  command: event.meta?.command ?? null,
  meta: event.meta ?? null,
});

// Occurrences of the same fingerprint. Written out in full: drizzle leaves the outer column
// unqualified in single-table selects, which would make it match the inner alias.
const occurrencesColumn = () =>
  sql<number>`(select count(*) from "error_events" e2 where e2."fingerprint" = "error_events"."fingerprint")`.mapWith(Number);

// Wildcards in the search text would match everything; IDs and context labels never contain them
const escapeLike = (value: string) => value.replace(/[%_]/g, "");

const sqliteStore = (db: Extract<DatabaseConnection, { dialect: "sqlite" }>["db"]): ErrorStore => {
  const t = sqliteEvents;
  const columns = {
    id: t.id,
    fingerprint: t.fingerprint,
    createdAt: t.createdAt,
    context: t.context,
    name: t.name,
    message: t.message,
    stack: t.stack,
    meta: t.meta,
    occurrences: occurrencesColumn(),
  };
  const select = () => db.select(columns).from(t);

  return {
    async record(event) {
      await db.insert(t).values(toValues(event));
    },
    async getById(id) {
      const [row] = await select().where(eq(t.id, id)).limit(1);
      return row ? toEvent(row) : null;
    },
    async listLatest(limit) {
      return (await select().orderBy(desc(t.createdAt)).limit(limit)).map(toEvent);
    },
    async search(query, limit) {
      const q = escapeLike(query.toLowerCase());
      const rows = await select()
        .where(or(like(t.id, `${q}%`), sql`lower(${t.context}) like ${`%${q}%`}`))
        .orderBy(desc(t.createdAt))
        .limit(limit);
      return rows.map(toEvent);
    },
    async prune(cutoff) {
      const result = await db.delete(t).where(lt(t.createdAt, cutoff));
      return result.rowsAffected;
    },
  };
};

const pgStore = (db: Extract<DatabaseConnection, { dialect: "postgres" }>["db"]): ErrorStore => {
  const t = pgEvents;
  const columns = {
    id: t.id,
    fingerprint: t.fingerprint,
    createdAt: t.createdAt,
    context: t.context,
    name: t.name,
    message: t.message,
    stack: t.stack,
    meta: t.meta,
    occurrences: occurrencesColumn(),
  };
  const select = () => db.select(columns).from(t);

  return {
    async record(event) {
      await db.insert(t).values(toValues(event));
    },
    async getById(id) {
      const [row] = await select().where(eq(t.id, id)).limit(1);
      return row ? toEvent(row) : null;
    },
    async listLatest(limit) {
      return (await select().orderBy(desc(t.createdAt)).limit(limit)).map(toEvent);
    },
    async search(query, limit) {
      const q = escapeLike(query.toLowerCase());
      const rows = await select()
        .where(or(like(t.id, `${q}%`), sql`lower(${t.context}) like ${`%${q}%`}`))
        .orderBy(desc(t.createdAt))
        .limit(limit);
      return rows.map(toEvent);
    },
    async prune(cutoff) {
      // postgres.js only reports rows for RETURNING queries, so count the returned IDs
      const deleted = await db.delete(t).where(lt(t.createdAt, cutoff)).returning({ id: t.id });
      return deleted.length;
    },
  };
};

export const createErrorStore = (connection: DatabaseConnection): ErrorStore =>
  connection.dialect === "postgres" ? pgStore(connection.db) : sqliteStore(connection.db);
