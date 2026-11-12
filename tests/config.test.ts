import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config/config.js";

const APP_ID = "123456789012345678";
const base = { DISCORD_TOKEN: "sample-token", APPLICATION_ID: APP_ID };

describe("loadConfig", () => {
  it("throws a descriptive error when DISCORD_TOKEN is missing", () => {
    expect(() => loadConfig({ APPLICATION_ID: APP_ID })).toThrow("DISCORD_TOKEN");
  });

  it("parses a valid configuration", () => {
    const config = loadConfig({
      ...base,
      DEV_USER_IDS: "111111111111111111, 222222222222222222",
      AUTO_REGISTER_COMMANDS: "true",
      MULTI_GUILD: "1",
      SUPPORT_URL: "https://discord.gg/example",
    });

    expect(config.token).toBe("sample-token");
    expect(config.devUserIds).toEqual(["111111111111111111", "222222222222222222"]);
    expect(config.autoRegisterCommands).toBe(true);
    expect(config.multiGuild).toBe(true);
    expect(config.supportUrl).toBe("https://discord.gg/example");
  });

  it("treats blank values as unset and applies defaults", () => {
    const config = loadConfig({ ...base, GUILD_ID: "", DEV_USER_IDS: "", LOG_LEVEL: "" });

    expect(config.guildId).toBeUndefined();
    expect(config.devUserIds).toEqual([]);
    expect(config.logLevel).toBe("info");
    expect(config.database.enabled).toBe(true);
  });

  it("rejects placeholder text where a Discord ID is expected", () => {
    expect(() => loadConfig({ ...base, GUILD_ID: "optional-guild-id-for-dev" })).toThrow("GUILD_ID");
    expect(() => loadConfig({ ...base, DEV_USER_IDS: "your-discord-user-id" })).toThrow("DEV_USER_IDS");
  });

  it("rejects booleans it does not understand instead of reading them as false", () => {
    expect(() => loadConfig({ ...base, DB_ENABLED: "ture" })).toThrow("DB_ENABLED");
  });

  it("only accepts http(s) support URLs", () => {
    expect(() => loadConfig({ ...base, SUPPORT_URL: "javascript:alert(1)" })).toThrow("SUPPORT_URL");
    expect(() => loadConfig({ ...base, SUPPORT_URL: "ftp://example.com" })).toThrow("SUPPORT_URL");
  });

  it("explains that DEV_ID was removed", () => {
    expect(() => loadConfig({ ...base, DEV_ID: APP_ID })).toThrow("DEV_ID was removed");
  });
});
