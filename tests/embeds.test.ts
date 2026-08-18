import { describe, it, expect } from "vitest";
import {
  createSuccessEmbed,
  createErrorEmbed,
  createWarningEmbed,
  createInfoEmbed,
  EmbedColors,
} from "../src/utils/embeds.js";

describe("Embed Builder Helpers", () => {
  it("should create a success embed with green color code", () => {
    const embed = createSuccessEmbed("Operation Completed", "All tasks succeeded.");
    const json = embed.toJSON();

    expect(json.title).toBe("Operation Completed");
    expect(json.description).toBe("All tasks succeeded.");
    expect(json.color).toBe(EmbedColors.Success);
    expect(json.timestamp).toBeDefined();
  });

  it("should create an error embed with red color code", () => {
    const embed = createErrorEmbed("Error Detected", "Something went wrong.");
    const json = embed.toJSON();

    expect(json.title).toBe("Error Detected");
    expect(json.color).toBe(EmbedColors.Error);
  });

  it("should create a warning embed with yellow color code", () => {
    const embed = createWarningEmbed("Caution");
    const json = embed.toJSON();

    expect(json.title).toBe("Caution");
    expect(json.color).toBe(EmbedColors.Warning);
  });

  it("should create an info embed with custom or default blurple color", () => {
    const embed = createInfoEmbed("Information", "Notice details");
    const json = embed.toJSON();

    expect(json.title).toBe("Information");
    expect(json.color).toBe(EmbedColors.Default);
  });
});
