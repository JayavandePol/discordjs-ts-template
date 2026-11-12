import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Project root (two levels up from src/utils or dist/utils), with forward slashes
const PROJECT_ROOT = path
  .resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  .replace(/\\/g, "/")
  .toLowerCase();

const FINGERPRINT_FRAMES = 5;

/**
 * Removes Node.js internals and dependency frames (node_modules) from a stack trace.
 */
export const cleanStackTrace = (stack: string): string =>
  stack
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("at ")) return true; // keep the "Error: message" header
      if (trimmed.includes("node:internal") || trimmed.includes("node:timers")) return false;
      if (trimmed.includes("node_modules")) return false;
      return true;
    })
    .join("\n");

/**
 * Normalizes one stack frame so it is the same on every machine and deploy:
 * forward slashes, no file:// prefix, paths relative to the project, no column number.
 */
const normalizeFrame = (frame: string): string => {
  let line = frame.trim().replace(/\\/g, "/").replace(/file:\/\/\/?/g, "");
  const lower = line.toLowerCase();
  const rootIndex = lower.indexOf(PROJECT_ROOT);
  if (rootIndex !== -1) line = line.slice(0, rootIndex) + line.slice(rootIndex + PROJECT_ROOT.length + 1);
  return line.replace(/:(\d+):\d+(\)?)$/, ":$1$2");
};

/**
 * Groups occurrences of the same bug: a hash of the context, the error class and the top
 * in-project stack frames. The message is left out on purpose, because messages often
 * contain IDs or user input that differ on every occurrence.
 */
export const errorFingerprint = (error: unknown, context: string): string => {
  let material = context;

  if (error instanceof Error) {
    const frames = cleanStackTrace(error.stack ?? "")
      .split("\n")
      .filter((line) => line.trim().startsWith("at "))
      .slice(0, FINGERPRINT_FRAMES)
      .map(normalizeFrame);

    // Without frames (e.g. errors created far from our code) the message is all we have
    material += `|${error.name}|${frames.length > 0 ? frames.join("|") : error.message}`;
  } else {
    material += `|${String(error)}`;
  }

  // 128 bits: collisions between different bugs are practically impossible
  return crypto.createHash("sha256").update(material).digest("hex").slice(0, 32);
};

/**
 * Random, short report ID shown to users ("Error ID: 3f9a1c07be"). Unique per occurrence,
 * so the developer sees the reporter's own context, not the last person who hit the bug.
 */
export const generateReportId = (): string => crypto.randomBytes(5).toString("hex");
