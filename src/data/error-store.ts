import { Op } from "sequelize";
import { ErrorModel } from "./models/error-model.js";
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
};

export class ErrorStore {
  constructor(private model: typeof ErrorModel) {}

  async recordError(payload: Omit<ErrorRecord, "timestamp" | "severity"> & { timestamp?: string; severity?: string }) {
    const timestamp = payload.timestamp ?? new Date().toISOString();
    const severity = payload.severity ?? "error";
    const metaString =
      payload.meta === undefined
        ? null
        : typeof payload.meta === "string"
        ? payload.meta
        : JSON.stringify(payload.meta);

    await this.model.create({
      ...payload,
      timestamp: new Date(timestamp),
      severity,
      meta: metaString,
      guildId: payload.guildId ?? null,
      userId: payload.userId ?? null,
      command: payload.command ?? null,
    });
  }

  async getById(id: string): Promise<ErrorRecord | null> {
    const row = await this.model.findByPk(id);
    if (!row) return null;
    return this.hydrate(row);
  }

  async listLatest(limit = 10): Promise<ErrorRecord[]> {
    const rows = await this.model.findAll({
      order: [["timestamp", "DESC"]],
      limit,
    });
    return rows.map((row) => this.hydrate(row));
  }

  async prune(days: number): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return await this.model.destroy({
      where: {
        timestamp: {
          [Op.lt]: cutoff,
        },
      },
    });
  }

  private hydrate(row: ErrorModel): ErrorRecord {
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
      meta: row.meta ? (this.safeJson(row.meta) as ErrorMeta) : undefined,
    };
  }

  private safeJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
