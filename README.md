# Discord Bot Template

A discord.js v14 + TypeScript starter: typed slash and context menu commands, component handlers, a central access check, error reports with IDs, and SQLite or PostgreSQL through Drizzle ORM.

It is a starting point, not a finished product. Read [What you still decide](#what-you-still-decide) before you run it for real users.

## Features

- **Typed commands**: `defineSlashCommand`, `defineUserCommand` and `defineMessageCommand`, loaded from `src/commands/` and validated at startup (duplicate names and malformed files fail fast).
- **One access check** (`src/core/access.ts`) for commands, autocomplete and components: public, admin (configurable permissions) and developer.
- **Developer commands stay private**: they are only registered in your dev server (`GUILD_ID`) and hidden from members there by default.
- **Crash-safe interaction handling**: every listener runs in an error boundary, and the error handler itself never throws. A failed reply, a database outage or a bad config value is reported instead of taking the bot down.
- **Error reports**: users get a short error ID. Reports are stored with a fingerprint that groups the same bug, posted to an optional log channel, and searchable with `/errors`.
- **Privacy by default**: reports store option names, never option values or modal text, and are deleted after `ERROR_RETENTION_DAYS`.
- **Database**: SQLite out of the box (no build tools), PostgreSQL or Turso via `DATABASE_URL`. Migrations run on startup.
- **Components and pagination**: button, select menu and modal handlers in `src/components/`, plus a button paginator.
- **Tooling**: Zod-validated config, pino logging, Vitest, ESLint with promise-safety rules, CI on Node 22/24/26, Dependabot and a Dockerfile.

## Quick start

Requires Node.js 22.12 or newer (24 recommended, see `.nvmrc`).

1. Create an application in the [Discord Developer Portal](https://discord.com/developers/applications), add a bot, and invite it to a test server with the `bot` and `applications.commands` scopes.
2. Copy the example config and fill in at least `DISCORD_TOKEN`, `APPLICATION_ID`, `GUILD_ID` (your test server) and `DEV_USER_IDS` (your user ID):

   ```bash
   cp .env.example .env
   ```

3. Install, register the commands in your test server, and start the bot:

   ```bash
   npm install
   npm run register:guild
   npm run dev
   ```

Empty values count as "not set". IDs are validated, so leftover placeholder text fails at startup with a clear message.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DISCORD_TOKEN` | required | Bot token |
| `APPLICATION_ID` | required | Application ID |
| `GUILD_ID` | | Dev server: target of `register:guild` and the only place developer commands exist |
| `DEV_USER_IDS` | | Comma-separated user IDs with developer access |
| `DEV_ROLE_ID` | | Role that also grants developer access, only inside `GUILD_ID` |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |
| `MULTI_GUILD` | `false` | Auto-registration publishes globally instead of to `GUILD_ID` |
| `AUTO_REGISTER_COMMANDS` | `false` | Register commands on every startup (keep off during development) |
| `ERRORLOGCHANNEL_ID` | | Channel for error reports with an "Inspect Stack" button (developers only) |
| `SUPPORT_URL` | | http(s) link for the "Contact Developer" button |
| `ERROR_RETENTION_DAYS` | `30` | Days to keep error reports; `0` keeps them forever |
| `DB_ENABLED` | `true` | `false` keeps error reports in the logs only |
| `DATABASE_URL` | `./data/database.sqlite` | SQLite path, `postgresql://...` or `libsql://...` |
| `DATABASE_AUTH_TOKEN` | | Token for Turso / remote libSQL |
| `DB_LOGGING` | `false` | Log SQL queries at debug level |

Booleans accept `true/false`, `1/0`, `yes/no` and `on/off`; anything else is an error.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run with `tsx watch` |
| `npm run build` / `npm start` | Compile to `dist/` (cleaned first) and run it with source maps |
| `npm run typecheck` | Type-check source, tests and config files |
| `npm run lint` | ESLint, including `no-floating-promises` |
| `npm test` / `npm run test:coverage` | Vitest |
| `npm run register:guild` | Replace the commands in `GUILD_ID` with all commands |
| `npm run register:global` | Publish public and admin commands globally; developer commands go to `GUILD_ID` only |
| `npm run register:clear -- --scope guild` | Remove all commands in a scope (`guild` or `global`) |
| `npm run db:generate` | Create a migration after changing `src/data/schema/*` |
| `npm run db:migrate` / `db:push` / `db:studio` | drizzle-kit commands for the configured database |

Guild commands update instantly; global commands can take a while to appear. After `register:guild`, a later `register:global` replaces the dev server's list with only the developer commands, so you never see every command twice.

## Adding things

### A slash command

Create `src/commands/hello.ts`:

```ts
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { defineSlashCommand } from "../types/Command.js";

export default defineSlashCommand({
  data: new SlashCommandBuilder().setName("hello").setDescription("Say hello"),
  cooldown: 5,
  async execute(interaction) {
    await interaction.reply({ content: `Hello ${interaction.user.username}!`, flags: MessageFlags.Ephemeral });
  },
});
```

Then run `npm run register:guild`.

- **Access**: files in `commands/administrator/` are admin-only and files in `commands/developer/` are developer-only. A command can set `access` to be stricter than its folder, never looser. Admin commands require Administrator unless you set `permissions` (for example `PermissionFlagsBits.ManageGuild`).
- **Slow work**: set `defer: true` or `defer: "ephemeral"` and answer with `editReply`.
- **Expected failures**: `throw new UserError("You don't have enough coins.")` shows the message to the user without creating an error report.

### A button, select menu or modal

```ts
// src/components/buttons/verify.ts
import { MessageFlags } from "discord.js";
import { defineButton } from "../../types/Component.js";

export default defineButton({
  customId: /^verify:.+$/, // exact string or RegExp
  async execute(interaction) {
    await interaction.reply({ content: "Verified!", flags: MessageFlags.Ephemeral });
  },
});
```

customIds starting with `collector:` are reserved for message collectors such as the paginator.

### A database table

1. Add the table to both `src/data/schema/sqlite.ts` and `src/data/schema/pg.ts` (or delete the dialect you don't use).
2. Generate migrations for each dialect:

   ```bash
   DATABASE_URL=:memory: npm run db:generate
   DATABASE_URL=postgres://localhost/any npm run db:generate
   ```

3. Commit the files in `drizzle/`. The bot applies them on startup, and CI fails if a schema change has no migration.

## Error reports

When something unexpected fails:

1. The user sees a private message with an error ID (and the support button if `SUPPORT_URL` is set).
2. The error is logged, stored with its fingerprint, and posted to `ERRORLOGCHANNEL_ID` (repeats of the same bug are throttled).
3. Developers inspect it with `/errors lookup <id>`, `/errors list`, or the "Inspect Stack" button.

Reports contain user, server and channel IDs plus option names, and are pruned after `ERROR_RETENTION_DAYS`.

## Deployment

```bash
docker build -t my-bot .
docker run -d --restart unless-stopped --env-file .env -v bot-data:/app/data my-bot
```

The image runs as a non-root user, applies migrations on startup and logs JSON to stdout; let Docker, systemd or your host collect the logs. Always run the bot under something that restarts it: after an uncaught exception it flushes its logs and exits so it can restart cleanly.

For PostgreSQL, set `DATABASE_URL=postgresql://...`; no volume is needed.

### Scaling

One process handles thousands of servers. Discord requires sharding at 2,500 servers; at that point add `shards: "auto"` to the `Client` options in `src/index.ts` (one process, several shards). Move to discord.js's `ShardingManager` only when one process is no longer enough, and keep in mind that cooldowns and the error-log throttle live in memory per process.

## What you still decide

- **Gateway intents**: only `Guilds` is enabled. Add the ones you need in `src/index.ts`; privileged intents (members, presences, message content) must also be enabled in the Developer Portal.
- **Data**: write a privacy policy that covers what your own features store, and choose a retention period.
- **Hosting**: a supervisor that restarts the process, and backups for SQLite (`/app/data`) or a managed PostgreSQL.

## Project structure

```
src/
  commands/            slash and context menu commands (administrator/ and developer/ set access)
  components/          buttons/, selectMenus/, modals/
  config/config.ts     environment validation
  core/                access check, loaders, command publisher
  data/                database connection, URL resolver, schemas, error store
  events/              interactionCreate (router) and ready
  scripts/             register-commands CLI
  types/               Command, Component, Event, BotContext, ErrorMeta
  utils/               logger, embeds, paginator, replies, error handling, cooldowns
drizzle/               migrations per dialect (sqlite/, pg/)
tests/                 Vitest suites
```

See [AGENTS.md](AGENTS.md) for the conventions to follow when generating code with an AI assistant.
