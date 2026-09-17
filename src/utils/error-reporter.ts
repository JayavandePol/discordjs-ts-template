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
 * Captures an error, generates a deterministic 8-character hash from its sanitized stack trace,
 * logs it with structured metadata, and stores/upserts it in the database if available.
 */
export const captureError = async (
  logger: Logger,
  error: unknown,
  context: string,
  errorStore?: ErrorStore,
  meta?: ErrorMeta
): Promise<ErrorReport> => {
  // Generate deterministic ID from stack trace and context
  const id = generateErrorHash(error, context);

  // Normalize error payload and sanitize stack trace
  const payload =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack ? cleanStackTrace(error.stack) : undefined }
      : { message: String(error) };

  // Log structured error to file and console
  logger.error(`Error captured (${context})`, { id, meta, ...payload });

  // Store in the database (via Drizzle ORM) if database is enabled
  if (errorStore) {
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
  }

  return {
    id,
    userMessage: `An unexpected error occurred. Please report this ID to the support team: **${id}**`,
  };
};
