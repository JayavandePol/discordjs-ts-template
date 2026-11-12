import type { ErrorStore } from "../data/error-store.js";
import type { Logger } from "./logger.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Deletes error reports older than `retentionDays`, once at startup and then every 6 hours.
 * Error reports include user, guild and channel IDs, so they should not be kept forever.
 * Returns a function that stops the schedule. `retentionDays` 0 keeps reports forever.
 */
export const startErrorRetention = (store: ErrorStore, retentionDays: number, logger: Logger): (() => void) => {
  if (retentionDays <= 0) return () => undefined;

  const prune = async () => {
    try {
      const removed = await store.prune(new Date(Date.now() - retentionDays * DAY_MS));
      if (removed > 0) logger.info(`Pruned ${removed} error reports older than ${retentionDays} days.`);
    } catch (error) {
      logger.warn("Failed to prune old error reports", error);
    }
  };

  void prune();
  const timer = setInterval(() => void prune(), PRUNE_INTERVAL_MS);
  timer.unref(); // never keeps the process alive on its own
  return () => clearInterval(timer);
};
