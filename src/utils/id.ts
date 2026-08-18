import crypto from "node:crypto";

/**
 * Removes internal Node.js and noise lines (like node_modules, discord.js internals) from the stack trace.
 * This ensures identical crashes across different machines or deployments generate matching error IDs.
 */
export const cleanStackTrace = (stack: string): string => {
  return stack
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("at ")) return true; // keep error message headers
      // Filter out node internals and npm dependencies
      if (trimmed.includes("node:internal") || trimmed.includes("node:timers")) return false;
      if (trimmed.includes("node_modules")) return false;
      return true;
    })
    .join("\n");
};

/**
 * Generates a deterministic 8-character hex hash based on an error's sanitized stack trace
 * (or message and context). The exact same crash signature produces the exact same Error ID.
 */
export const generateErrorHash = (error: unknown, context: string): string => {
  let material = context;

  if (error instanceof Error) {
    if (error.stack) {
      material += cleanStackTrace(error.stack);
    } else {
      material += error.message;
    }
  } else {
    material += String(error);
  }

  // Generate 8-character deterministic ID
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 8);
};
