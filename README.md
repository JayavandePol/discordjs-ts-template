# Advanced Discord Bot Template

TypeScript + discord.js v14 starter with structured commands, auto-registration on startup, environment-driven config, JSON logging with error IDs, and optional Sequelize-backed error storage.

## Features
- Slash-command ready with `/ping`
- Autoloaded commands/events (recursive folders); single shared bot context (config, logger, client)
- JSON logs to console + `logs/YYYY-MM-DD.log`; user-facing error IDs
- Optional error-log channel notifications with a Details button for per-error info
- Command registration script _and_ automatic registration on startup (guild or global)
- Dev-only tools: `/status` diagnostics, `/errors test|lookup`
- Optional database persistence via Sequelize (SQLite by default; switchable via env)
- Hot reload via `nodemon` + `ts-node`

## Quick start
1. Copy `.env.example` to `.env` and set:
   - `DISCORD_TOKEN` — bot token
   - `APPLICATION_ID` — your application ID
   - `GUILD_ID` — optional; when set and `MULTI_GUILD=false`, commands register to this guild for faster iteration
   - `DEV_ID` — your Discord user ID for dev-only commands
   - `ERRORLOGCHANNEL_ID` — optional channel ID to receive error embeds with a Details button
   - `MULTI_GUILD` — `true` to prefer global registration; `false` to prefer guild when `GUILD_ID` is set
   - Database (optional, used for error storage):
     - `DB_ENABLED` — `true`/`false` to toggle storage
     - `DB_HOST` — dialect selector: `sqlite` | `postgres` | `mysql` | `mariadb` | `mssql`
     - `DB_HOSTNAME` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` — connection pieces for non-sqlite
     - `DB_STORAGE` — path for SQLite (default `./data/database.sqlite`)
     - `DB_LOGGING` — `true` to log SQL via the bot logger
     - Alternatively, set `DATABASE_URL` and leave the other DB_* fields empty
2. Install deps: `npm install`
3. Run the bot locally: `npm run dev`
   - Commands auto-register on startup based on `MULTI_GUILD`/`GUILD_ID`
   - You can still force registration via the scripts below

## Scripts
- `npm run dev` — ts-node with nodemon reload
- `npm run build` — compile to `dist`
- `npm start` — run compiled build
- `npm run lint` — type-check
- `npm run register:global` — force global command registration
- `npm run register:guild` — force guild command registration (needs `GUILD_ID`)

## Project layout
```
src/
  commands/
    administrator/              Commands restricted to guild Administrator permission
    developer/                  Commands restricted to DEV_ID
    (others)                    Public commands
  config/config.ts              Env loading + Config type
  core/                         Command/event loaders + publisher
  data/                         Sequelize setup + models
  events/                       Event handlers (recursive)
  scripts/register-commands.ts  CLI for registering slash commands
  types/                        Shared Command/Event/Context types
  utils/                        Logger + error helpers
```

## Adding commands
Create `src/commands/my-command.ts`:
```ts
import { SlashCommandBuilder } from "discord.js";
import { Command } from "../types/Command.js";

const command: Command = {
  data: new SlashCommandBuilder().setName("hello").setDescription("Say hi"),
  async execute(interaction, { logger }) {
    await interaction.reply("Hi!");
    logger.info("Greeted a user", { user: interaction.user.id });
  },
};

export default command;
```
Then rerun the register script or restart the bot (auto-registers on startup).

## Error handling
- Errors are captured with a UUID and logged as JSON including stack trace.
- When DB is enabled, errors are persisted via Sequelize for lookup (with user/guild/channel metadata).
- Users see: `Something went wrong (error ID: <id>).` via ephemeral reply.
- If `ERRORLOGCHANNEL_ID` is set, the bot posts an embed to that channel with a Details button to fetch the full error (only the invoking user or `DEV_ID` can view details).
- Dev-only `/errors` command lets you create a test record or look up by ID.
- Logs live at `logs/YYYY-MM-DD.log` for easy correlation.
