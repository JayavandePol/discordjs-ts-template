/**
 * Context stored with an error report. Deliberately holds no free-form user input:
 * option values and modal fields can contain personal data, so only option names are kept.
 */
export type ErrorMeta = {
  userId?: string;
  guildId?: string;
  channelId?: string;

  // Command name, or the customId for buttons, select menus and modals
  command?: string;
  // "group subcommand" for slash commands that have them
  subcommand?: string;

  // Names of the options the user filled in (never their values)
  optionNames?: string[];
};
