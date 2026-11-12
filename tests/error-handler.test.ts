import { describe, expect, it, vi } from "vitest";
import { handleInteractionError } from "../src/utils/error-handler.js";
import { UserError } from "../src/utils/user-error.js";
import type { ErrorStore } from "../src/data/error-store.js";
import { fakeContext, fakeInteraction, testConfig } from "./helpers/fakes.js";

const failingStore = (): ErrorStore => ({
  record: vi.fn(async () => {
    throw new Error('relation "error_events" does not exist');
  }),
  getById: vi.fn(),
  listLatest: vi.fn(),
  search: vi.fn(),
  prune: vi.fn(),
});

describe("handleInteractionError", () => {
  it("replies with an error ID", async () => {
    const context = fakeContext();
    const interaction = fakeInteraction("slash");

    await handleInteractionError(interaction as never, context, new Error("boom"), "command:test");

    expect(interaction.reply).toHaveBeenCalledOnce();
    const payload = interaction.reply.mock.calls[0]?.[0] as { embeds: { data: { description: string } }[] };
    expect(payload.embeds[0]?.data.description).toMatch(/Error ID: \*\*[0-9a-f]{10}\*\*/);
  });

  it("never throws when the database, the reply and the support URL all fail", async () => {
    const context = { ...fakeContext(), errorStore: failingStore() };
    // Bypass config validation to simulate a link Discord would reject
    context.config = { ...testConfig(), supportUrl: "javascript:alert(1)" };
    const interaction = fakeInteraction("slash", {
      reply: vi.fn(async () => {
        throw new Error("Unknown interaction");
      }),
    });

    await expect(
      handleInteractionError(interaction as never, context, new Error("boom"), "command:test")
    ).resolves.toBeUndefined();
    expect(context.logger.error).toHaveBeenCalled();
  });

  it("follows up instead of overwriting a reply that was already sent", async () => {
    const interaction = fakeInteraction("slash", { replied: true });

    await handleInteractionError(interaction as never, fakeContext(), new Error("boom"), "command:test");

    expect(interaction.followUp).toHaveBeenCalledOnce();
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it("shows UserError messages without reporting a crash", async () => {
    const context = { ...fakeContext(), errorStore: failingStore() };
    const interaction = fakeInteraction("slash");

    await handleInteractionError(interaction as never, context, new UserError("Not enough coins."), "command:test");

    expect(context.errorStore.record).not.toHaveBeenCalled();
    const payload = interaction.reply.mock.calls[0]?.[0] as { embeds: { data: { description: string } }[] };
    expect(payload.embeds[0]?.data.description).toBe("Not enough coins.");
  });

  it("stores option names but never option values", async () => {
    const store = { ...failingStore(), record: vi.fn(async () => undefined) };
    const context = { ...fakeContext(), errorStore: store };
    const interaction = fakeInteraction("slash", {
      options: {
        data: [{ name: "settings", type: 1, options: [{ name: "email", type: 3, value: "me@example.com" }] }],
        getSubcommand: () => "settings",
        getSubcommandGroup: () => null,
      },
    });

    await handleInteractionError(interaction as never, context, new Error("boom"), "command:test");

    const stored = JSON.stringify(store.record.mock.calls[0]);
    expect(stored).toContain('"optionNames":["email"]');
    expect(stored).toContain('"subcommand":"settings"');
    expect(stored).not.toContain("me@example.com");
  });
});
