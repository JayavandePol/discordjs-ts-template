import crypto from "node:crypto";

/**
 * Removes internal Node.js and noise lines (like node_modules, discord.js) from the stack trace
 * so that errors occurring in different environments or slightly different paths
 * still group together cleanly, and so they are much easier for developers to read.
 */
export const cleanStackTrace = (stack: string): string => {
  return stack
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("at ")) return true; // keep error message headers
      // Filter out node internals and npm modules
      if (trimmed.includes("node:internal") || trimmed.includes("node:timers")) return false;
      if (trimmed.includes("node_modules")) return false;
      return true;
    })
    .join("\n");
};

/**
 * Generates a deterministic hash for an error based on its clean stack trace (if available)
 * or its message and context. This ensures the exact same crash generates the exact same ID.
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

  // Generate an 8-character deterministic ID based on the error signature
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 8);
};
