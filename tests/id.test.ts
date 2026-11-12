import { describe, it, expect } from "vitest";
import { cleanStackTrace, errorFingerprint, generateReportId } from "../src/utils/id.js";

const withStack = (message: string, stack: string) => {
  const error = new Error(message);
  error.stack = `Error: ${message}\n${stack}`;
  return error;
};

describe("cleanStackTrace", () => {
  it("strips node internals and node_modules frames", () => {
    const cleaned = cleanStackTrace(`Error: Something failed
    at execute (P:/bot/src/commands/ping.ts:15:20)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async emit (node_modules/discord.js/src/client.js:100:10)`);

    expect(cleaned).toContain("P:/bot/src/commands/ping.ts:15:20");
    expect(cleaned).not.toContain("node:internal");
    expect(cleaned).not.toContain("node_modules");
  });
});

describe("errorFingerprint", () => {
  const frames = "    at execute (/srv/a/src/commands/ping.ts:15:20)";

  it("is 128 bits of hex", () => {
    expect(errorFingerprint(new Error("x"), "command:ping")).toMatch(/^[0-9a-f]{32}$/);
  });

  it("ignores the message so errors with changing details are grouped", () => {
    const a = withStack("User 111 not found", frames);
    const b = withStack("User 222 not found", frames);
    expect(errorFingerprint(a, "command:ping")).toBe(errorFingerprint(b, "command:ping"));
  });

  it("ignores column numbers", () => {
    const a = withStack("x", "    at execute (/srv/a/src/commands/ping.ts:15:20)");
    const b = withStack("x", "    at execute (/srv/a/src/commands/ping.ts:15:31)");
    expect(errorFingerprint(a, "c")).toBe(errorFingerprint(b, "c"));
  });

  it("separates different contexts and different code locations", () => {
    const error = withStack("x", frames);
    expect(errorFingerprint(error, "command:ping")).not.toBe(errorFingerprint(error, "command:status"));

    const elsewhere = withStack("x", "    at execute (/srv/a/src/commands/ping.ts:40:20)");
    expect(errorFingerprint(error, "c")).not.toBe(errorFingerprint(elsewhere, "c"));
  });
});

describe("generateReportId", () => {
  it("creates short random IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, generateReportId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{10}$/);
  });
});
