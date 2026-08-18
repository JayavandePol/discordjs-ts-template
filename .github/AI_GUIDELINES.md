# AI Development Guidelines

This document provides an overview of the project structure and guidelines for AI assistants to generate high-quality, compatible code for this Discord.js TypeScript bot.

## Project Structure

The project is a **Discord.js v14** bot built with **TypeScript**, **ES Modules (ESM)**, **tsx**, **Vitest**, and **Multi-Dialect Drizzle ORM** (SQLite, PostgreSQL, MySQL/MariaDB).

### Directory Layout (`src/`)

*   **`index.ts`**: The entry point. Initializes the client, database, components, cooldowns, and loads handlers.
*   **`sharding.ts`**: Alternative entry point for production (1000+ servers). Uses `ShardingManager`.
*   **`commands/`**: Contains slash command and context menu definitions.
    *   **`developer/`**: Commands restricted to developers in `DEV_USER_IDS` or `DEV_ROLE_ID`.
    *   **`administrator/`**: Commands restricted to guild administrators (`setDefaultMemberPermissions`).
    *   **`user-info.ts`**: Example User Context Menu command.
    *   **`quote-message.ts`**: Example Message Context Menu command.
*   **`components/`**: Modular interactive component handlers.
    *   **`buttons/`**: Button handlers (e.g. `error-info.ts`).
    *   **`selectMenus/`**: Select menu handlers.
    *   **`modals/`**: Modal submission handlers.
*   **`events/`**: Contains event handlers (e.g., `ready`, `interactionCreate`).
*   **`core/`**: Core logic for the bot framework.
    *   `command-registry.ts`: Loads commands recursively from `commands/`.
    *   `component-registry.ts`: Loads component handlers from `components/`.
    *   `command-publisher.ts`: Registers commands with the Discord API (guild or global).
    *   `event-registry.ts`: Loads and registers events from `events/`.
*   **`types/`**: TypeScript definitions.
    *   `Command.ts`: Interface for slash and context menu commands (supports `cooldown`, `defer`, `autocomplete`).
    *   `Component.ts`: Handler interfaces for `ButtonHandler`, `SelectMenuHandler`, and `ModalHandler`.
    *   `Event.ts`: Interface for event handlers.
    *   `Context.ts`: The `BotContext` object passed to commands/events/components.
    *   `ErrorMeta.ts`: Metadata shape attached to error records.
*   **`utils/`**: Utility functions.
    *   `logger.ts`: Custom JSON logger (use this instead of `console`).
    *   `embeds.ts`: Standardized embed builder helpers (`createSuccessEmbed`, `createErrorEmbed`, etc.).
    *   `paginator.ts`: Button-driven embed pagination utility (`paginate()`).
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
*   **`tests/`**: Automated unit tests run via `vitest`.

---

## AI Behavior & Reasoning Strategy

When acting as a developer for this project, adopt the following mindset:

### 1. Problem Solving & Thinking Process
*   **Scalability First**:
    *   **Sharding**: For 1000+ servers, use `src/sharding.ts` as the entry point instead of `src/index.ts`.
    *   **Database**: SQLite is for zero-config development. PostgreSQL and MySQL/MariaDB are fully supported by setting `DATABASE_URL`.
    *   **State**: Never store state in memory (variables/Maps) that needs to persist across restarts. Use Drizzle ORM.
*   **User Experience & Interactive UI**:
    *   Use `src/components/` for buttons, select menus, and modals instead of cluttering command files.
    *   Use `paginate()` from `src/utils/paginator.ts` whenever displaying lists of items.
    *   Use `src/utils/embeds.ts` for clean, consistent embeds.
    *   Use `UserError` for expected validation/business logic rejections.
    *   Set `cooldown` on commands susceptible to spam.
    *   Set `defer: true` or `defer: "ephemeral"` for operations that may take >2.5 seconds.

### 2. Requirements for AI Prompts & Code Generation

1.  **Language & Module System**:
    *   Use **TypeScript** and **ES Modules** (`import` / `export default`).
    *   Always include the `.js` extension for local imports (`import { Command } from "../types/Command.js"`).
    *   Do **not** use `require()`.

2.  **Slash Command Structure**:
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
        const embed = createSuccessEmbed("Title", "Description");
        await interaction.reply({ embeds: [embed] });
      }
    };
    export default command;
    ```

3.  **Context Menu Command Structure**:
    ```typescript
    import { ContextMenuCommandBuilder, ApplicationCommandType, UserContextMenuCommandInteraction } from "discord.js";
    import { Command } from "../types/Command.js";

    const command: Command<UserContextMenuCommandInteraction> = {
      data: new ContextMenuCommandBuilder()
        .setName("User Info")
        .setType(ApplicationCommandType.User),
      execute: async (interaction, context) => {
        // handle interaction
      }
    };
    export default command;
    ```

4.  **Button Handler Structure**:
    ```typescript
    import { ButtonHandler } from "../../types/Component.js";

    const button: ButtonHandler = {
      customId: "myfeature:action", // string or RegExp (/^myfeature:.+$/)
      execute: async (interaction, context) => {
        await interaction.reply({ content: "Handled!", ephemeral: true });
      }
    };
    export default button;
    ```

5.  **Embed Paginator**:
    ```typescript
    import { paginate } from "../utils/paginator.js";

    await paginate(interaction, [embed1, embed2, embed3], { timeout: 60_000, ephemeral: true });
    ```
