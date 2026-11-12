import { Logger } from "./logger.js";
import { cleanStackTrace, errorFingerprint, generateReportId } from "./id.js";
import type { ErrorStore } from "../data/error-store.js";
import { ErrorMeta } from "../types/ErrorMeta.js";

export type ErrorReport = {
  // Random per-occurrence ID shown to the user
  id: string;
  // Groups occurrences of the same bug
  fingerprint: string;
  userMessage: string;
};

/**
 * Logs an error and stores it in the database when one is configured.
 * Never throws: a failing database must not turn one error into a crash.
 */
export const captureError = async (
  logger: Logger,
  error: unknown,
  context: string,
  errorStore?: ErrorStore,
  meta?: ErrorMeta
): Promise<ErrorReport> => {
  const id = generateReportId();
  const fingerprint = errorFingerprint(error, context);

  logger.error(`Error captured (${context})`, { id, fingerprint, meta, err: error });

  if (errorStore) {
    try {
      await errorStore.record({
        id,
        fingerprint,
        context,
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error && error.stack ? cleanStackTrace(error.stack) : undefined,
        meta,
      });
    } catch (storeError) {
      logger.error("Failed to store error report", { id, err: storeError });
    }
  }

  return {
    id,
    fingerprint,
    userMessage: `An unexpected error occurred. Please report this ID to the support team: **${id}**`,
  };
};
