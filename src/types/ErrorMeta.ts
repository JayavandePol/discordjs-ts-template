export type ErrorMeta = {
  userId?: string;
  guildId?: string;
  channelId?: string;
  command?: string;
  [key: string]: unknown;
};
