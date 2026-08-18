import { PrismaClient, Prisma } from "@prisma/client";
import { ErrorMeta } from "../types/ErrorMeta.js";

// Type definition for a fully hydrated error record retrieved from storage
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

// Database repository class wrapping Prisma operations on the errors table
export class ErrorStore {
  constructor(private prisma: PrismaClient) {}

  /**
   * Persists an error report to the database.
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
    const meta = payload.meta ?? null;

    await this.prisma.errorEntry.upsert({
      where: { id: payload.id },
      create: {
        id: payload.id,
        timestamp: new Date(timestamp),
        severity,
        context: payload.context,
        name: payload.name ?? null,
        message: payload.message,
        stack: payload.stack ?? null,
        guildId: payload.guildId ?? null,
        userId: payload.userId ?? null,
        command: payload.command ?? null,
        meta: meta as Prisma.InputJsonValue,
        occurrences: 1,
      },
      update: {
        timestamp: new Date(timestamp),
        occurrences: { increment: 1 },
        meta: meta as Prisma.InputJsonValue,
        userId: payload.userId ?? undefined,
        guildId: payload.guildId ?? undefined,
        command: payload.command ?? undefined,
        context: payload.context,
      },
    });
  }

  /**
   * Retrieve a specific error record by its unique 8-character ID.
   */
  async getById(id: string): Promise<ErrorRecord | null> {
    const row = await this.prisma.errorEntry.findUnique({ where: { id } });
    if (!row) return null;
    return this.hydrate(row);
  }

  /**
   * Retrieve the latest logged errors ordered by timestamp descending.
   */
  async listLatest(limit = 10): Promise<ErrorRecord[]> {
    const rows = await this.prisma.errorEntry.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return rows.map((row) => this.hydrate(row));
  }

  /**
   * Delete error entries older than a specified number of days.
   */
  async prune(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const result = await this.prisma.errorEntry.deleteMany({
      where: {
        timestamp: {
          lt: cutoff,
        },
      },
    });
    return result.count;
  }

  /**
   * Transforms raw Prisma database rows into strongly-typed ErrorRecord objects.
   */
  private hydrate(row: {
    id: string;
    timestamp: Date;
    severity: string;
    context: string;
    name: string | null;
    message: string;
    stack: string | null;
    guildId: string | null;
    userId: string | null;
    command: string | null;
    meta: Prisma.JsonValue;
    occurrences: number;
  }): ErrorRecord {
    return {
      id: row.id,
      timestamp: row.timestamp.toISOString(),
      severity: row.severity,
      context: row.context,
      name: row.name ?? undefined,
      message: row.message,
      stack: row.stack ?? undefined,
      guildId: row.guildId ?? undefined,
      userId: row.userId ?? undefined,
      command: row.command ?? undefined,
      meta: row.meta ? (row.meta as ErrorMeta) : undefined,
      occurrences: row.occurrences,
    };
  }
}
