import { describe, it, expect, vi, beforeEach } from "vitest";
import { CooldownManager } from "../src/utils/cooldown-manager.js";

describe("CooldownManager", () => {
  let manager: CooldownManager;

  beforeEach(() => {
    manager = new CooldownManager();
    vi.useFakeTimers();
  });

  it("should allow first command execution (no cooldown)", () => {
    const remaining = manager.check("ping", "user-123", 5);
    expect(remaining).toBeNull();
  });

  it("should return remaining seconds if command is on cooldown", () => {
    manager.check("ping", "user-123", 10);

    // Advance clock by 3 seconds
    vi.advanceTimersByTime(3000);

    const remaining = manager.check("ping", "user-123", 10);
    expect(remaining).toBe(7);
  });

  it("should allow command execution again after cooldown expires", () => {
    manager.check("ping", "user-123", 5);

    // Advance clock past expiration
    vi.advanceTimersByTime(6000);

    const remaining = manager.check("ping", "user-123", 5);
    expect(remaining).toBeNull();
  });

  it("should track cooldowns separately per user and command", () => {
    manager.check("ping", "user-1", 10);

    // Different user on same command
    expect(manager.check("ping", "user-2", 10)).toBeNull();

    // Same user on different command
    expect(manager.check("help", "user-1", 10)).toBeNull();
  });
});
