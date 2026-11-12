import { Logger } from "./logger.js";
import { generateErrorHash, cleanStackTrace } from "./id.js";
import { ErrorStore } from "../data/error-store.js";
import { ErrorMeta } from "../types/ErrorMeta.js";

// Result summary of a captured error
export type ErrorReport = {
  id: string;
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
  const id = generateErrorHash(error, context);

  const payload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack ? cleanStackTrace(error.stack) : undefined }
      : { message: String(error) };

  logger.error(`Error captured (${context})`, { id, meta, err: error });

  if (errorStore) {
    try {
      await errorStore.recordError({
        id,
        context,
        message: payload.message,
        name: "name" in payload ? payload.name : undefined,
        stack: "stack" in payload ? payload.stack : undefined,
        meta,
        guildId: meta?.guildId,
        userId: meta?.userId,
        command: meta?.command,
      });
    } catch (storeError) {
      logger.error("Failed to store error report", { id, err: storeError });
    }
  }

  return {
    id,
    userMessage: `An unexpected error occurred. Please report this ID to the support team: **${id}**`,
  };
};
