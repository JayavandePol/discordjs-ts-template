import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { Client, Events } from "discord.js";
import { loadCommands } from "../src/core/command-registry.js";
import { registerEvents } from "../src/core/event-registry.js";
import { parseRegisterArgs } from "../src/scripts/register-commands.js";
import { fakeContext, fakeLogger } from "./helpers/fakes.js";

const fixtures = path.resolve(import.meta.dirname, "fixtures");

describe("registerEvents", () => {
  it("logs a failing listener instead of letting discord.js turn it into an uncaught exception", async () => {
    const client = new Client({ intents: [] });
    const logger = fakeLogger();
    const clientError = vi.fn();
    client.on(Events.Error, clientError);
    const uncaught = vi.fn();
    process.on("uncaughtException", uncaught);

    try {
      await registerEvents(client, fakeContext(), logger, path.join(fixtures, "events"));
      client.emit(Events.InteractionCreate, {} as never);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalledWith("Event handler failed", expect.objectContaining({ file: "throws.ts" }));
      expect(clientError).not.toHaveBeenCalled();
      expect(uncaught).not.toHaveBeenCalled();
    } finally {
      process.off("uncaughtException", uncaught);
      await client.destroy();
    }
  });
});

describe("loadCommands", () => {
  it("loads the bundled commands with their folder access levels", async () => {
    const commands = await loadCommands(fakeLogger());
    expect(commands.get("slash:ping")?.access).toBe("public");
    expect(commands.get("slash:admintest")?.access).toBe("admin");
    expect(commands.get("slash:errors")?.access).toBe("developer");
    expect(commands.get("user:User Info")?.kind).toBe("user");
  });

  it("rejects duplicate command names", async () => {
    await expect(loadCommands(fakeLogger(), path.join(fixtures, "commands-duplicate"))).rejects.toThrow("Duplicate");
  });

  it("rejects a command that is weaker than its folder", async () => {
    await expect(loadCommands(fakeLogger(), path.join(fixtures, "commands-weak"))).rejects.toThrow("weaker");
  });
});

describe("parseRegisterArgs", () => {
  it("accepts guild and global", () => {
    expect(parseRegisterArgs(["--scope", "guild"])).toEqual({ scope: "guild", clear: false });
    expect(parseRegisterArgs(["--scope=global", "--clear"])).toEqual({ scope: "global", clear: true });
  });

  it("rejects typos and a missing scope instead of falling through to global", () => {
    expect(() => parseRegisterArgs(["--scope", "gild"])).toThrow("Invalid or missing --scope");
    expect(() => parseRegisterArgs([])).toThrow("Invalid or missing --scope");
  });
});
