import { describe, it, expect } from "vitest";
import { cleanStackTrace, generateErrorHash } from "../src/utils/id.js";

describe("Error ID & Sanitization Utilities", () => {
  it("should strip node:internal and node_modules from stack traces", () => {
    const rawStack = `Error: Something failed
    at execute (P:/bot/src/commands/ping.ts:15:20)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async emit (node_modules/discord.js/src/client.js:100:10)`;

    const cleaned = cleanStackTrace(rawStack);

    expect(cleaned).toContain("P:/bot/src/commands/ping.ts:15:20");
    expect(cleaned).not.toContain("node:internal");
    expect(cleaned).not.toContain("node_modules");
  });

  it("should generate deterministic 8-character hashes for identical errors", () => {
    const createSampleError = () => new Error("Database timeout");
    const error = createSampleError();

    const hash1 = generateErrorHash(error, "command:query");
    const hash2 = generateErrorHash(error, "command:query");

    expect(hash1).toHaveLength(8);
    expect(hash1).toBe(hash2);
  });

  it("should generate distinct hashes for different error contexts or messages", () => {
    const error = new Error("General crash");
    const hashA = generateErrorHash(error, "command:ping");
    const hashB = generateErrorHash(error, "command:status");

    expect(hashA).not.toBe(hashB);
  });
});
