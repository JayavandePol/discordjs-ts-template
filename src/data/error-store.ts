import { eq, desc, lt, sql } from "drizzle-orm";
import { DatabaseConnection } from "./db.js";
import { sqliteErrors } from "./schema/sqlite.js";
import { pgErrors } from "./schema/pg.js";
import { mysqlErrors } from "./schema/mysql.js";
import { ErrorMeta } from "../types/ErrorMeta.js";

// Type definition for an error record
export type ErrorRecord = {
  id: string;
  timestamp: string;
  severity: string;
  context: string;
  name?: string;
  message: string;
  stack?: string;
  guildId?: string;
  userId?: string;
  command?: string;
  meta?: ErrorMeta;
  occurrences: number;
};

/**
 * Universal multi-dialect repository class wrapping Drizzle ORM queries
 * across SQLite, PostgreSQL, and MySQL/MariaDB.
 */
export class ErrorStore {
  constructor(private db: DatabaseConnection) {}

  /**
   * Persists an error report to the active database dialect.
   * If an error with the same deterministic ID already exists, increments occurrences and updates timestamp.
   */
  async recordError(
    payload: Omit<ErrorRecord, "timestamp" | "severity" | "occurrences"> & {
      timestamp?: string;
      severity?: string;
    }
  ): Promise<void> {
    const timestamp = payload.timestamp ?? new Date().toISOString();
    const severity = payload.severity ?? "error";

    // 1. SQLite execution (better-sqlite3)
    if (this.db.dialect === "sqlite" && this.db.sqlite) {
      await this.db.sqlite
        .insert(sqliteErrors)
        .values({
          id: payload.id,
          timestamp,
          severity,
          context: payload.context,
          name: payload.name ?? null,
          message: payload.message,
          stack: payload.stack ?? null,
          guildId: payload.guildId ?? null,
          userId: payload.userId ?? null,
          command: payload.command ?? null,
          meta: payload.meta ? JSON.stringify(payload.meta) : null,
          occurrences: 1,
        })
        .onConflictDoUpdate({
          target: sqliteErrors.id,
          set: {
            timestamp,
            occurrences: sql`${sqliteErrors.occurrences} + 1`,
            meta: payload.meta ? JSON.stringify(payload.meta) : null,
            userId: payload.userId ?? undefined,
            guildId: payload.guildId ?? undefined,
            command: payload.command ?? undefined,
            context: payload.context,
          },
        });
      return;
    }

    // 2. PostgreSQL execution
    if (this.db.dialect === "postgres" && this.db.pg) {
      await this.db.pg
        .insert(pgErrors)
        .values({
          id: payload.id,
          timestamp,
          severity,
          context: payload.context,
          name: payload.name ?? null,
          message: payload.message,
          stack: payload.stack ?? null,
          guildId: payload.guildId ?? null,
          userId: payload.userId ?? null,
          command: payload.command ?? null,
          meta: payload.meta ?? null,
          occurrences: 1,
        })
        .onConflictDoUpdate({
          target: pgErrors.id,
          set: {
            timestamp,
            occurrences: sql`${pgErrors.occurrences} + 1`,
            meta: payload.meta ?? null,
            userId: payload.userId ?? undefined,
            guildId: payload.guildId ?? undefined,
            command: payload.command ?? undefined,
            context: payload.context,
          },
        });
      return;
    }

    // 3. MySQL / MariaDB execution
    if (this.db.dialect === "mysql" && this.db.mysql) {
      await this.db.mysql
        .insert(mysqlErrors)
        .values({
          id: payload.id,
          timestamp,
          severity,
          context: payload.context,
          name: payload.name ?? null,
          message: payload.message,
          stack: payload.stack ?? null,
          guildId: payload.guildId ?? null,
          userId: payload.userId ?? null,
          command: payload.command ?? null,
          meta: payload.meta ?? null,
          occurrences: 1,
        })
        .onDuplicateKeyUpdate({
          set: {
            timestamp,
            occurrences: sql`${mysqlErrors.occurrences} + 1`,
            meta: payload.meta ?? null,
            userId: payload.userId ?? undefined,
            guildId: payload.guildId ?? undefined,
            command: payload.command ?? undefined,
            context: payload.context,
          },
        });
      return;
    }
  }

  /**
   * Retrieve a specific error record by its unique 8-character ID.
   */
  async getById(id: string): Promise<ErrorRecord | null> {
    if (this.db.dialect === "sqlite" && this.db.sqlite) {
      const [row] = await this.db.sqlite
        .select()
        .from(sqliteErrors)
        .where(eq(sqliteErrors.id, id))
        .limit(1);
      return row ? this.hydrate(row) : null;
    }

    if (this.db.dialect === "postgres" && this.db.pg) {
      const [row] = await this.db.pg
        .select()
        .from(pgErrors)
        .where(eq(pgErrors.id, id))
        .limit(1);
      return row ? this.hydrate(row) : null;
    }

    if (this.db.dialect === "mysql" && this.db.mysql) {
      const [row] = await this.db.mysql
        .select()
        .from(mysqlErrors)
        .where(eq(mysqlErrors.id, id))
        .limit(1);
      return row ? this.hydrate(row) : null;
    }

    return null;
  }

  /**
   * Retrieve the latest logged errors ordered by timestamp descending.
   */
  async listLatest(limit = 10): Promise<ErrorRecord[]> {
    if (this.db.dialect === "sqlite" && this.db.sqlite) {
      const rows = await this.db.sqlite
        .select()
        .from(sqliteErrors)
        .orderBy(desc(sqliteErrors.timestamp))
        .limit(limit);
      return rows.map((row) => this.hydrate(row));
    }

    if (this.db.dialect === "postgres" && this.db.pg) {
      const rows = await this.db.pg
        .select()
        .from(pgErrors)
        .orderBy(desc(pgErrors.timestamp))
        .limit(limit);
      return rows.map((row) => this.hydrate(row));
    }

    if (this.db.dialect === "mysql" && this.db.mysql) {
      const rows = await this.db.mysql
        .select()
        .from(mysqlErrors)
        .orderBy(desc(mysqlErrors.timestamp))
        .limit(limit);
      return rows.map((row) => this.hydrate(row));
    }

    return [];
  }

  /**
   * Delete error entries older than a specified number of days.
   */
  async prune(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();

    if (this.db.dialect === "sqlite" && this.db.sqlite) {
      const res = await this.db.sqlite
        .delete(sqliteErrors)
        .where(lt(sqliteErrors.timestamp, cutoffIso));
      return res.rowsAffected;
    }

    if (this.db.dialect === "postgres" && this.db.pg) {
      const res = await this.db.pg
        .delete(pgErrors)
        .where(lt(pgErrors.timestamp, cutoffIso));
      return res.length;
    }

    if (this.db.dialect === "mysql" && this.db.mysql) {
      const [res] = await this.db.mysql
        .delete(mysqlErrors)
        .where(lt(mysqlErrors.timestamp, cutoffIso));
      return Number(res.affectedRows);
    }

    return 0;
  }

  /**
   * Hydrates raw SQL row records into standardized ErrorRecord objects.
   */
  private hydrate(row: {
    id: string;
    timestamp: string;
    severity: string;
    context: string;
    name: string | null;
    message: string;
    stack: string | null;
    guildId: string | null;
    userId: string | null;
    command: string | null;
    meta: unknown;
    occurrences: number;
  }): ErrorRecord {
    let parsedMeta: ErrorMeta | undefined;
    if (typeof row.meta === "string") {
      try {
        parsedMeta = JSON.parse(row.meta);
      } catch {
        parsedMeta = undefined;
      }
    } else if (typeof row.meta === "object" && row.meta !== null) {
      parsedMeta = row.meta as ErrorMeta;
    }

    return {
      id: row.id,
      timestamp: row.timestamp,
      severity: row.severity,
      context: row.context,
      name: row.name ?? undefined,
      message: row.message,
      stack: row.stack ?? undefined,
      guildId: row.guildId ?? undefined,
      userId: row.userId ?? undefined,
      command: row.command ?? undefined,
      meta: parsedMeta,
      occurrences: row.occurrences,
    };
  }
}
