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
   - `DEV_ID` — a role ID; users with this role can use developer commands
   - `ERRORLOGCHANNEL_ID` — optional channel ID to receive error embeds with a Details button
   - `MULTI_GUILD` — `true` to prefer global registration; `false` to prefer guild when `GUILD_ID` is set
   - `SUPPORT_URL` — URL for the "Contact Developer" button (e.g., a channel link)
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
- Errors in slash commands are caught automatically by the central handler — no boilerplate needed.
- Throw a `UserError` from `src/utils/user-error.ts` for expected validation/permission failures. This will politely reply to the user without spamming error logs or creating an error ID.
- Real system crashes are captured with a **deterministic Error ID hash** based on the stack trace. The exact same crash always gets the exact same ID.
- Errors are persisted via Sequelize for lookup. If the same crash happens again, it UPSERTs the DB row and simply increments the `occurrences` count instead of duplicating rows.
- Unnecessary Node.js internals and `node_modules` lines are automatically stripped from the stack trace for readability.
- Slash Command options and Modal form inputs are automatically captured into the error `meta` so you know exactly what the user typed.
- Users see a rich error embed with the Error ID and a "Contact Developer" button.
- The bot posts an embed to `ERRORLOGCHANNEL_ID` with a Details button. If the exact same crash happens >5 times in 60s, it temporarily suppresses the channel embed to prevent massive spam.
- Dev-only `/errors lookup <id>` command lets you view the full trace, inputs, and occurrences.