import { describe, expect, it, vi } from "vitest";
import { SlashCommandBuilder } from "discord.js";
import router from "../src/events/interactionCreate.js";
import { defineSlashCommand } from "../src/types/Command.js";
import { DEV_ID, fakeContext, fakeInteraction } from "./helpers/fakes.js";

const devCommand = (autocomplete = vi.fn(async () => undefined)) =>
  defineSlashCommand({
    data: new SlashCommandBuilder().setName("test").setDescription("test"),
    access: "developer",
    execute: vi.fn(async () => undefined),
    autocomplete,
  });

const run = (interaction: unknown, context: ReturnType<typeof fakeContext>) =>
  (router.execute as (...args: unknown[]) => Promise<void>)(interaction, context);

describe("interactionCreate router", () => {
  it("does not run autocomplete for users who may not use the command", async () => {
    const autocomplete = vi.fn(async () => undefined);
    const interaction = fakeInteraction("autocomplete");

    await run(interaction, fakeContext({ commands: [devCommand(autocomplete)] }));

    expect(autocomplete).not.toHaveBeenCalled();
    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it("runs autocomplete for developers and answers [] when it fails", async () => {
    const autocomplete = vi.fn(async () => {
      throw new Error("db down");
    });
    const interaction = fakeInteraction("autocomplete", { user: { id: DEV_ID } });

    await run(interaction, fakeContext({ commands: [devCommand(autocomplete)] }));

    expect(autocomplete).toHaveBeenCalledOnce();
    expect(interaction.respond).toHaveBeenCalledWith([]);
  });

  it("denies developer commands to other users", async () => {
    const command = devCommand();
    const interaction = fakeInteraction("slash");

    await run(interaction, fakeContext({ commands: [command] }));

    expect(command.execute).not.toHaveBeenCalled();
    expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("restricted") }));
  });

  it("turns a failed deferReply into an error response instead of a crash", async () => {
    const command = defineSlashCommand({
      data: new SlashCommandBuilder().setName("test").setDescription("test"),
      defer: true,
      execute: vi.fn(async () => undefined),
    });
    const interaction = fakeInteraction("slash", {
      deferReply: vi.fn(async () => {
        throw new Error("Unknown interaction");
      }),
    });
    const context = fakeContext({ commands: [command] });

    await expect(run(interaction, context)).resolves.toBeUndefined();
    expect(command.execute).not.toHaveBeenCalled();
    expect(context.logger.error).toHaveBeenCalled();
  });

  it("tells the user when a button has no handler, but leaves collector buttons alone", async () => {
    const expired = fakeInteraction("button", { customId: "old:feature" });
    await run(expired, fakeContext());
    expect(expired.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("no longer active") }));

    const collector = fakeInteraction("button", { customId: "collector:paginator:1:next" });
    await run(collector, fakeContext());
    expect(collector.reply).not.toHaveBeenCalled();
  });
});
