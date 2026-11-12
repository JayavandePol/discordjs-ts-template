import { vi } from "vitest";
import { PermissionsBitField } from "discord.js";
import { loadConfig, type Config } from "../../src/config/config.js";
import type { Command } from "../../src/types/Command.js";
import type { BotContext } from "../../src/types/Context.js";
import type { Logger } from "../../src/utils/logger.js";
import { CooldownManager } from "../../src/utils/cooldown-manager.js";

export const DEV_ID = "111111111111111111";
export const USER_ID = "222222222222222222";
export const GUILD_ID = "333333333333333333";
export const ROLE_ID = "444444444444444444";

export const testConfig = (env: Record<string, string> = {}): Config =>
  loadConfig({
    DISCORD_TOKEN: "token",
    APPLICATION_ID: "123456789012345678",
    GUILD_ID,
    DEV_USER_IDS: DEV_ID,
    DB_ENABLED: "false",
    ...env,
  });

export const fakeLogger = () =>
  ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), flush: vi.fn(async () => undefined) }) as unknown as Logger & {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

type Kind = "slash" | "button" | "autocomplete";

type Spy = ReturnType<typeof vi.fn>;
export type FakeInteraction = Record<string, unknown> & {
  reply: Spy;
  deferReply: Spy;
  editReply: Spy;
  followUp: Spy;
  respond: Spy;
};

/**
 * A minimal stand-in for a discord.js interaction: enough for the router, access checks and
 * error handler. Reply methods are spies and track replied/deferred like discord.js does.
 */
export const fakeInteraction = (kind: Kind, overrides: Record<string, unknown> = {}) => {
  const interaction: Record<string, unknown> = {
    id: "999999999999999999",
    user: { id: USER_ID },
    guildId: null as string | null,
    channelId: "555555555555555555",
    member: null as unknown,
    memberPermissions: null as PermissionsBitField | null,
    commandName: "test",
    customId: "test:button",
    replied: false,
    deferred: false,
    responded: false,
    options: { data: [], getSubcommand: () => null, getSubcommandGroup: () => null, getFocused: () => "" },
    inGuild() {
      return this.guildId != null;
    },
    inCachedGuild() {
      return this.guildId != null && this.member != null;
    },
    isAutocomplete: () => kind === "autocomplete",
    isRepliable: () => kind !== "autocomplete",
    isCommand: () => kind === "slash",
    isChatInputCommand: () => kind === "slash",
    isContextMenuCommand: () => false,
    isUserContextMenuCommand: () => false,
    isMessageContextMenuCommand: () => false,
    isButton: () => kind === "button",
    isAnySelectMenu: () => false,
    isModalSubmit: () => false,
    reply: vi.fn(async () => {
      interaction.replied = true;
    }),
    deferReply: vi.fn(async () => {
      interaction.deferred = true;
    }),
    editReply: vi.fn(async () => undefined),
    followUp: vi.fn(async () => undefined),
    respond: vi.fn(async () => {
      interaction.responded = true;
    }),
    ...overrides,
  };
  return interaction as FakeInteraction;
};

export const asGuildMember = (permissions: bigint, roles: string[] = []) => ({
  guildId: GUILD_ID,
  member: { roles: { cache: new Set(roles) } },
  memberPermissions: new PermissionsBitField(permissions),
});

export const fakeContext = (options: { config?: Config; commands?: Command[]; components?: Partial<BotContext["components"]> } = {}) => {
  const commands = new Map<string, Command>();
  for (const command of options.commands ?? []) commands.set(`${command.kind}:${command.data.name}`, command);

  return {
    client: {} as BotContext["client"],
    logger: fakeLogger(),
    config: options.config ?? testConfig(),
    commands,
    components: {
      isCollectorOwned: (id: string) => id.startsWith("collector:"),
      findButton: () => undefined,
      findSelectMenu: () => undefined,
      findModal: () => undefined,
      ...options.components,
    } as unknown as BotContext["components"],
    cooldowns: new CooldownManager(),
    errorStore: undefined,
  } satisfies BotContext;
};
