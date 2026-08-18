# AI Development Guidelines

This document provides an overview of the project structure and guidelines for AI assistants to generate high-quality, compatible code for this Discord.js TypeScript bot.

## Project Structure

The project is a **Discord.js v14** bot built with **TypeScript**, **ES Modules (ESM)**, **tsx**, and **Multi-Dialect Drizzle ORM** (SQLite, PostgreSQL, MySQL/MariaDB).

### Directory Layout (`src/`)

*   **`index.ts`**: The entry point. Initializes the client, multi-dialect Drizzle database, cooldowns, and loads handlers.
*   **`sharding.ts`**: Alternative entry point for production (1000+ servers). Uses `ShardingManager`.
*   **`commands/`**: Contains slash command definitions.
    *   **`developer/`**: Commands restricted to developers in `DEV_USER_IDS` or `DEV_ROLE_ID`.
    *   **`administrator/`**: Commands restricted to guild administrators (`setDefaultMemberPermissions`).
    *   **`*`**: Other folders/files are public commands.
    *   *Note: The loader automatically derives access levels based on the folder name.*
*   **`events/`**: Contains event handlers (e.g., `ready`, `interactionCreate`).
*   **`core/`**: Core logic for the bot framework.
    *   `command-registry.ts`: Loads commands recursively from `commands/`.
    *   `command-publisher.ts`: Registers commands with the Discord API (guild or global).
    *   `event-registry.ts`: Loads and registers events from `events/`.
*   **`types/`**: TypeScript definitions.
    *   `Command.ts`: Interface for slash commands (supports `cooldown`, `defer`, `autocomplete`).
    *   `Event.ts`: Interface for event handlers.
    *   `Context.ts`: The `BotContext` object passed to commands/events.
    *   `ErrorMeta.ts`: Metadata shape attached to error records.
*   **`utils/`**: Utility functions.
    *   `logger.ts`: Custom JSON logger (use this instead of `console`).
    *   `embeds.ts`: Standardized embed builder helpers (`createSuccessEmbed`, `createErrorEmbed`, etc.).
    *   `cooldown-manager.ts`: Per-user command cooldown tracker.
    *   `error-reporter.ts`: Captures errors with a deterministic hash, logs them, and stores to DB.
    *   `error-log.ts`: Sends error embeds to a designated error log channel with throttling.
    *   `id.ts`: Sanitizes stack traces and generates unique error IDs.
*   **`data/`**: Database layer (Drizzle ORM).
    *   `schema/`: Dialect-specific table schemas (`sqlite.ts`, `pg.ts`, `mysql.ts`).
    *   `db.ts`: Multi-dialect Drizzle database connection factory (`initDatabase`).
    *   `error-store.ts`: Store class wrapping error logging and queries across all dialects.
*   **`config/`**: Configuration loading and Zod environment variable validation (`src/config/config.ts`).
*   **`scripts/`**: CLI utilities (e.g., `register-commands.ts`).

---

## AI Behavior & Reasoning Strategy

When acting as a developer for this project, adopt the following mindset:

### 1. Problem Solving & Thinking Process
*   **Scalability First**:
    *   **Sharding**: For 1000+ servers, use `src/sharding.ts` as the entry point instead of `src/index.ts`.
    *   **Database**: SQLite is for zero-config development. PostgreSQL and MySQL/MariaDB are fully supported by simply setting `DATABASE_URL`.
    *   **State**: Never store state in memory (variables/Maps) that needs to persist across restarts. Use Drizzle ORM.
*   **Rate Limits**: Never call `registerApplicationCommands` unconditionally on startup. Use `npm run register:guild` or `npm run register:global`.
*   **Traceability**: Every unexpected error must be traceable. Never swallow errors. Always use `captureError` to generate an ID and `notifyErrorLogChannel` to alert the error log channel.
*   **User Experience**:
    *   Use `src/utils/embeds.ts` for clean, consistent embeds.
    *   Use `UserError` for expected validation/business logic rejections.
    *   Set `cooldown` on commands susceptible to spam.
    *   Set `defer: true` or `defer: "ephemeral"` for operations that may take >2.5 seconds.

### 2. Requirements for AI Prompts & Code Generation

1.  **Language & Module System**:
    *   Use **TypeScript** and **ES Modules** (`import` / `export default`).
    *   Always include the `.js` extension for local imports (`import { Command } from "../types/Command.js"`).
    *   Do **not** use `require()`.

2.  **Command Structure**:
    ```typescript
    import { SlashCommandBuilder } from "discord.js";
    import { Command } from "../types/Command.js";
    import { createSuccessEmbed } from "../utils/embeds.js";

    const command: Command = {
      data: new SlashCommandBuilder()
        .setName("name")
        .setDescription("description"),
      cooldown: 5, // optional cooldown in seconds
      defer: false, // optional auto-deferral (true | "ephemeral")
      execute: async (interaction, context) => {
        // implementation
      }
    };
    export default command;
    ```

3.  **Command with Autocomplete**:
    ```typescript
    const command: Command = {
      data: new SlashCommandBuilder()
        .setName("search")
        .setDescription("Search something")
        .addStringOption(opt =>
          opt.setName("query").setDescription("Query").setRequired(true).setAutocomplete(true)
        ),
      async autocomplete(interaction, context) {
        const focused = interaction.options.getFocused();
        await interaction.respond([{ name: "Option 1", value: "opt1" }]);
      },
      async execute(interaction, context) {
        // execute
      }
    };
    ```

4.  **Logging**:
    *   **NEVER** use `console.log` or `console.error`. Always use `context.logger`.
