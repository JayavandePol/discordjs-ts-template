export type ErrorMeta = {
  userId?: string;
  guildId?: string;
  channelId?: string;
  command?: string;
  options?: Record<string, string | number | boolean>;
  [key: string]: unknown;
};
