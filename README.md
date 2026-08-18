# Advanced Discord Bot Template

Production-ready Discord.js v14 + TypeScript starter with structured commands, dynamic autocompletion, component routing, built-in cooldowns, Zod configuration validation, deterministic error hashes, and optional Prisma database storage.

---

## ✨ Key Features

- **Modern TypeScript & ESM:** Powered by `tsx` for sub-millisecond hot-reloading with zero loader configuration.
- **Zod Environment Validation:** Fails fast with descriptive error messages on boot if credentials or configs are invalid.
- **Slash Commands & Autocomplete:** Modular command structure with built-in per-user cooldowns and automatic reply deferral.
- **Safe Rate Limit Handling:** Guarded command auto-deployment on startup to prevent hitting Discord API rate limits during development.
- **Developer Access Controls:** Flexible access control supporting Developer User IDs (across guilds & DMs) and guild role IDs.
- **Standardized Embed Presets:** Consistent color themes and reusable embed helpers (`createSuccessEmbed`, `createErrorEmbed`, etc.).
- **Deterministic Error Tracking:** Crashes generate unique 8-character stack trace hashes, deduplicated and tracked via Prisma.
- **Error Channel Notifications:** Posts rich alerts with an interactive "Inspect Stack" button and 60-second anti-spam throttling.
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

### 2. Install & Setup Database
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
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
| `npm run build` | Compiles TypeScript source files into `dist/` |
| `npm start` | Runs compiled JavaScript output from `dist/` |
| `npm run lint` | Type-checks code with `tsc --noEmit` |
| `npm run register:guild` | Deploys slash commands to your development `GUILD_ID` |
| `npm run register:global` | Deploys slash commands globally across Discord |
| `npm run prisma:generate` | Generates Prisma client types |
| `npm run prisma:migrate` | Runs Prisma migrations for SQLite or configured database |

---

## 📁 Project Structure

```
src/
├── commands/               # Slash command definitions
│   ├── administrator/      # Commands requiring Administrator permission
│   ├── developer/          # Commands restricted to bot developers
│   └── ping.ts             # Public command example with cooldown & embeds
├── config/
│   └── config.ts           # Zod environment schema and validation
├── core/
│   ├── command-publisher.ts# Discord REST API command deployer
│   ├── command-registry.ts # Dynamic recursive command loader
│   └── event-registry.ts   # Dynamic event loader
├── data/
│   ├── error-store.ts      # Prisma error repository
│   └── prisma.ts           # Prisma database client initializer
├── events/
│   ├── interactionCreate.ts# Interaction router (Commands, Autocomplete, Buttons)
│   └── ready.ts            # Client ready listener
├── scripts/
│   └── register-commands.ts# CLI deployment utility
├── types/
│   ├── Command.ts          # Command interface with cooldown & defer options
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
    └── user-error.ts       # Expected UserError exception class
```

---

## 🛡️ Access Control & Gating

- **Public Commands:** Place in `src/commands/` or subfolders.
- **Admin Commands:** Place in `src/commands/administrator/`. Native Discord UI permissions (`setDefaultMemberPermissions`) and code checks ensure only server admins can run them.
- **Developer Commands:** Place in `src/commands/developer/`. Restricted to user snowflakes in `DEV_USER_IDS` or `DEV_ROLE_ID`.

---

## 💡 Adding a New Command

Create `src/commands/hello.ts`:
```ts
import { SlashCommandBuilder } from "discord.js";
import { Command } from "../types/Command.js";
import { createSuccessEmbed } from "../utils/embeds.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hello")
    .setDescription("Say hello to the bot"),
  cooldown: 5, // 5-second per-user cooldown
  async execute(interaction, { logger }) {
    const embed = createSuccessEmbed("👋 Hello!", `Greetings, <@${interaction.user.id}>!`);
    await interaction.reply({ embeds: [embed] });
    logger.info("Greeted user", { userId: interaction.user.id });
  },
};

export default command;
```
Deploy the new command with `npm run register:guild`.