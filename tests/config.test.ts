import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config/config.js";

describe("Configuration Loader & Zod Validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should throw a descriptive error when DISCORD_TOKEN is missing", () => {
    delete process.env.DISCORD_TOKEN;
    process.env.APPLICATION_ID = "123456789";

    expect(() => loadConfig()).toThrow("[Config Error] Invalid environment configuration");
  });

  it("should successfully parse valid environment configurations", () => {
    process.env.DISCORD_TOKEN = "sample-token-xyz";
    process.env.APPLICATION_ID = "987654321";
    process.env.DEV_USER_IDS = "111,222,333";
    process.env.AUTO_REGISTER_COMMANDS = "true";
    process.env.MULTI_GUILD = "1";

    const config = loadConfig();

    expect(config.token).toBe("sample-token-xyz");
    expect(config.applicationId).toBe("987654321");
    expect(config.devUserIds).toEqual(["111", "222", "333"]);
    expect(config.autoRegisterCommands).toBe(true);
    expect(config.multiGuild).toBe(true);
  });
});
