import { EmbedBuilder, ColorResolvable } from "discord.js";

// Standard brand and status color palette
export const EmbedColors = {
  Default: 0x5865f2, // Discord Blurple
  Success: 0x57f287, // Discord Green
  Warning: 0xfee75c, // Discord Yellow
  Error: 0xed4245,   // Discord Red
  Dark: 0x2b2d31,    // Discord Dark Theme
} as const;

/**
 * Creates a standard informative embed with consistent styling and timestamp.
 */
export const createInfoEmbed = (
  title: string,
  description?: string,
  color: ColorResolvable = EmbedColors.Default
): EmbedBuilder => {
  const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp();
  if (description) embed.setDescription(description);
  return embed;
};

/**
 * Creates a success embed (green accent) for positive user confirmations.
 */
export const createSuccessEmbed = (
  title: string,
  description?: string
): EmbedBuilder => {
  return createInfoEmbed(title, description, EmbedColors.Success);
};

/**
 * Creates a warning embed (yellow accent) for notices or non-fatal alerts.
 */
export const createWarningEmbed = (
  title: string,
  description?: string
): EmbedBuilder => {
  return createInfoEmbed(title, description, EmbedColors.Warning);
};

/**
 * Creates an error embed (red accent) for user-facing problem reports.
 */
export const createErrorEmbed = (
  title: string,
  description?: string
): EmbedBuilder => {
  return createInfoEmbed(title, description, EmbedColors.Error);
};
