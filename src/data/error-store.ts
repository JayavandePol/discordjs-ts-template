import { ErrorModel } from "./models/error-model.js";
import { ErrorMeta } from "../types/ErrorMeta.js";

export type ErrorRecord = {
  id: string;
  timestamp: string;
  context: string;
  name?: string;
  message: string;
  stack?: string;
  meta?: ErrorMeta;
};

export class ErrorStore {
  constructor(private model: typeof ErrorModel) {}

  async recordError(payload: Omit<ErrorRecord, "timestamp"> & { timestamp?: string }) {
    const timestamp = payload.timestamp ?? new Date().toISOString();
    const metaString =
      payload.meta === undefined
        ? null
        : typeof payload.meta === "string"
        ? payload.meta
        : JSON.stringify(payload.meta);

    await this.model.create({
      ...payload,
      timestamp: new Date(timestamp),
      meta: metaString,
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

  private hydrate(row: ErrorModel): ErrorRecord {
    return {
      id: row.id,
      timestamp: row.timestamp.toISOString(),
      context: row.context,
      name: row.name ?? undefined,
      message: row.message,
      stack: row.stack ?? undefined,
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
