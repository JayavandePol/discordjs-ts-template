import { PrismaClient, Prisma } from "@prisma/client";
import { ErrorMeta } from "../types/ErrorMeta.js";

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

export class ErrorStore {
  constructor(private prisma: PrismaClient) { }

  async recordError(payload: Omit<ErrorRecord, "timestamp" | "severity" | "occurrences"> & { timestamp?: string; severity?: string }) {
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
        meta,
        occurrences: 1,
      },
      update: {
        timestamp: new Date(timestamp),
        occurrences: { increment: 1 },
        meta,
        userId: payload.userId ?? undefined,
        guildId: payload.guildId ?? undefined,
        command: payload.command ?? undefined,
        context: payload.context,
      },
    });
  }

  async getById(id: string): Promise<ErrorRecord | null> {
    const row = await this.prisma.errorEntry.findUnique({ where: { id } });
    if (!row) return null;
    return this.hydrate(row);
  }

  async listLatest(limit = 10): Promise<ErrorRecord[]> {
    const rows = await this.prisma.errorEntry.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
    });
    return rows.map((row) => this.hydrate(row));
  }

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

  private hydrate(row: Prisma.ErrorEntryGetPayload<{}>): ErrorRecord {
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
