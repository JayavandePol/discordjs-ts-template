# Advanced Discord Bot Template

Production-ready Discord.js v14 + TypeScript starter with structured commands, dynamic autocompletion, modular component handlers, interactive pagination, context menu commands, built-in cooldowns, Zod configuration validation, deterministic error hashes, **Multi-Dialect Drizzle ORM** (SQLite, PostgreSQL, MySQL/MariaDB), and a **Vitest** automated test suite.

---

## ✨ Key Features

- **Modern TypeScript & ESM:** Powered by `tsx` for sub-millisecond hot-reloading with zero loader configuration.
- **Multi-Dialect Drizzle ORM:** Zero-config **SQLite** out of the box (`better-sqlite3`), with instant switching to **PostgreSQL** or **MySQL/MariaDB** via `DATABASE_URL`.
- **Modular Component Handlers:** Dedicated directory routing for Buttons, Select Menus, and Modals supporting exact matching and RegExp patterns (`src/components/`).
- **Interactive Embed Paginator:** Full button pagination helper (`⏮️`, `◀️`, `Page X/Y`, `▶️`, `⏭️`) with automatic collector and timeout handling (`src/utils/paginator.ts`).
- **Context Menu Commands:** Support for User and Message Context Menu commands alongside Slash commands (`src/commands/`).
- **Vitest Automated Testing:** High-speed unit tests covering cooldowns, error sanitization & hashing, configuration parsing, and embed builders.
- **Zod Environment Validation:** Fails fast with descriptive error messages on boot if credentials or configs are invalid.
- **Safe Rate Limit Handling:** Guarded command auto-deployment on startup to prevent hitting Discord API rate limits during development.
- **Developer Access Controls:** Flexible access control supporting Developer User IDs (across guilds & DMs) and guild role IDs.
- **Standardized Embed Presets:** Consistent color themes and reusable embed helpers (`createSuccessEmbed`, `createErrorEmbed`, etc.).
- **Deterministic Error Tracking:** Crashes generate unique 8-character stack trace hashes, deduplicated and tracked in the database.
- **Sharding Support:** Ready for 1000+ servers with `src/sharding.ts`.

---

## 🚀 Quick Start

### 1. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your bot credentials in `.env`:
- `DISCORD_TOKEN`: Your Discord Bot Token.
- `APPLICATION_ID`: Your Discord Application Client ID.
- `GUILD_ID`: Optional server ID for instantaneous command deployment during testing.
- `DEV_USER_IDS`: Your Discord User ID (allows developer commands in guilds and DMs).
- `AUTO_REGISTER_COMMANDS`: Keep `false` during local development (use CLI scripts instead).
- `DATABASE_URL`: Defaults to `./data/database.sqlite`. (Change to `postgresql://...` or `mysql://...` if using an external DB).

### 2. Install & Run Tests
```bash
npm install
npm test
```

### 3. Deploy Commands & Run
```bash
# Register commands to your test server (instant update):
npm run register:guild

# Start bot in development mode with live watch:
npm run dev
```

---

## 📜 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the bot in development mode using `tsx watch` |
| `npm test` | Runs the Vitest automated test suite |
| `npm run test:watch` | Runs Vitest in interactive watch mode |
| `npm run build` | Compiles TypeScript source files into `dist/` |
| `npm start` | Runs compiled JavaScript output from `dist/` |
| `npm run lint` | Type-checks code with `tsc --noEmit` |
| `npm run db:push` | Pushes schema changes directly to the database using `drizzle-kit` |
| `npm run db:generate` | Generates SQL migration files |
| `npm run db:studio` | Opens Drizzle Studio in your browser to inspect database tables |
| `npm run register:guild` | Deploys slash and context menu commands to your development `GUILD_ID` |
| `npm run register:global` | Deploys slash and context menu commands globally across Discord |

---

## 📁 Project Structure

```
src/
├── commands/               # Slash & Context Menu command definitions
│   ├── administrator/      # Commands requiring Administrator permission
│   ├── developer/          # Commands restricted to bot developers (with paginator)
│   ├── ping.ts             # Public slash command example with cooldown
│   ├── user-info.ts        # User Context Menu command
│   └── quote-message.ts    # Message Context Menu command
├── components/             # Modular interactive component handlers
│   ├── buttons/            # Button handlers (e.g. error-info.ts)
│   ├── selectMenus/        # Select menu handlers
│   └── modals/             # Modal submission handlers
├── config/
│   └── config.ts           # Zod environment schema and validation
├── core/
│   ├── command-publisher.ts# Discord REST API command deployer
│   ├── command-registry.ts # Dynamic recursive command loader
│   ├── component-registry.ts# Dynamic component handler loader
│   └── event-registry.ts   # Dynamic event loader
├── data/
│   ├── schema/             # Drizzle table schemas (sqlite, pg, mysql)
│   ├── db.ts               # Multi-dialect Drizzle database factory
│   └── error-store.ts      # Multi-dialect error repository
├── events/
│   ├── interactionCreate.ts# Universal interaction router
│   └── ready.ts            # Client ready listener
├── types/
│   ├── Command.ts          # Generic Command interface with cooldown & defer options
│   ├── Component.ts        # Button, Select Menu, and Modal handler interfaces
│   ├── Context.ts          # BotContext interface
│   ├── ErrorMeta.ts        # Error metadata shape
│   └── Event.ts            # Event interface
└── utils/
    ├── cooldown-manager.ts # Per-user command cooldown tracker
    ├── embeds.ts           # Standardized embed builder helpers
    ├── error-handler.ts    # Centralized interaction error catcher
    ├── error-log.ts        # Discord channel error notifier with throttling
    ├── error-reporter.ts   # Deterministic error hash generator & logger
    ├── id.ts               # Stack trace sanitization and hashing
    ├── logger.ts           # Daily rotating JSON file logger
    ├── paginator.ts        # Interactive button-based embed paginator
    └── user-error.ts       # Expected UserError exception class
tests/
├── config.test.ts          # Zod environment validation tests
├── cooldown-manager.test.ts# Rate limiting and cooldown tests
├── embeds.test.ts          # Embed presets and colors tests
└── id.test.ts              # Deterministic error hashing and stack sanitization tests
```

---

## 📖 Component Handlers Example

Create `src/components/buttons/verify.ts`:
```ts
import { ButtonHandler } from "../../types/Component.js";

const button: ButtonHandler = {
  customId: "verify:member", // Exact string or RegExp (/^verify:.+$/)
  async execute(interaction, { logger }) {
    await interaction.reply({ content: "You have been verified!", ephemeral: true });
  },
};

export default button;
```

---

## 📖 Embed Paginator Example

```ts
import { paginate } from "../utils/paginator.js";

// Array of EmbedBuilder pages
const pages = [embedPage1, embedPage2, embedPage3];

// Sends interactive ⏮️ ◀️ 1/3 ▶️ ⏭️ buttons with automatic collector & timeout
await paginate(interaction, pages, { timeout: 60_000, ephemeral: true });
```