# AI Development Guidelines

This document provides an overview of the project structure and guidelines for AI assistants to generate high-quality, compatible code for this Discord.js TypeScript bot.

## Project Structure

The project is a **Discord.js v14** bot built with **TypeScript** and **ES Modules (ESM)**.

### Directory Layout (`src/`)

*   **`index.ts`**: The entry point. Initializes the client, database, and loads handlers.
*   **`commands/`**: Contains slash command definitions.
    *   **`developer/`**: Commands restricted to the bot developer.
    *   **`administrator/`**: Commands restricted to guild administrators.
    *   **`*`**: Other folders/files are public commands.
    *   *Note: The loader automatically derives access levels based on the folder name.*
*   **`events/`**: Contains event handlers (e.g., `ready`, `interactionCreate`).
*   **`core/`**: Core logic for the bot framework.
    *   `command-registry.ts`: Loads commands recursively.
    *   `event-registry.ts`: Loads and registers events.
*   **`types/`**: TypeScript definitions.
    *   `Command.ts`: Interface for slash commands.
    *   `Event.ts`: Interface for event handlers.
    *   `Context.ts`: The `BotContext` object passed to commands/events.
*   **`utils/`**: Utility functions.
    *   `logger.ts`: Custom logger (use this instead of `console`).
    *   `error-reporter.ts`: Error handling utilities.
*   **`data/`**: Database layer (Sequelize).
    *   `models/`: Database models.
*   **`config/`**: Configuration loading.

## Where to Find What

*   **Adding a Command**: Create a new `.ts` file in `src/commands/`. Use `src/types/Command.ts` as a reference.
*   **Adding an Event**: Create a new `.ts` file in `src/events/`. Use `src/types/Event.ts` as a reference.
*   **Database Models**: Defined in `src/data/models/`.
*   **Environment Variables**: Accessed via `src/config/config.ts`.
*   **Error Handling**: Utilities in `src/utils/error-reporter.ts` and storage in `src/data/error-store.ts`.

## AI Behavior & Reasoning Strategy

When acting as a developer for this project, adopt the following mindset:

### 1. Problem Solving & Thinking Process
*   **Scalability First**:
    *   **Sharding**: For 1000+ servers, the bot must be sharded. Use `src/sharding.ts` as the entry point instead of `src/index.ts`.
    *   **Database**: Use **PostgreSQL** or **MySQL** for production. SQLite is only for development.
    *   **State**: Never store state in memory (variables/Maps) that needs to persist. Use the database.
*   **Traceability**: Every error must be traceable. Never swallow errors. Always use `captureError` to generate an ID.
*   **User Experience**:
    *   Errors should be friendly to the user (Embeds with "Contact Developer" buttons).
    *   Success messages should be clear.
    *   Use Discord UI components (Buttons, Select Menus, Modals) where appropriate instead of just text.

### 2. Response Style
*   **Concise & Technical**: Focus on the code and the architecture.
*   **Context-Aware**: Reference existing files (`src/types/Command.ts`, `src/utils/error-reporter.ts`) instead of reinventing the wheel.
*   **Safety**: Always validate inputs and permissions.

## Requirements for AI Prompts & Code Generation

To ensure generated code works perfectly without modification, please follow these rules:

1.  **Language & Module System**:
    *   Use **TypeScript**.
    *   Use **ES Modules** (`import` / `export default`).
    *   Do **not** use `require()`.

2.  **Command Structure**:
    *   Commands must export a `default` object implementing the `Command` interface.
    *   **Interface**:
        ```typescript
        import { SlashCommandBuilder } from "discord.js";
        import { Command } from "../types/Command.js";

        const command: Command = {
            data: new SlashCommandBuilder()
                .setName("name")
                .setDescription("description"),
            execute: async (interaction, context) => {
                // implementation
            }
        };
        export default command;
        ```
    *   **Context**: Always use the `context` argument (type `BotContext`) to access `logger`, `config`, etc.

3.  **Event Structure**:
    *   Events must export a `default` object implementing the `Event` interface.
    *   **Interface**:
        ```typescript
        import { Events } from "discord.js";
        import { Event } from "../types/Event.js";

        const event: Event<Events.ClientReady> = {
            name: Events.ClientReady,
            once: true,
            execute: async (client, context) => {
                // implementation
            }
        };
        export default event;
        ```

4.  **Logging**:
    *   **NEVER** use `console.log` or `console.error`.
    *   Use `context.logger.info()`, `context.logger.warn()`, `context.logger.error()`, etc.

5.  **Imports**:
    *   Always include the `.js` extension for local imports (e.g., `import { Command } from "../types/Command.js"`). This is required for ESM in Node.js.

6.  **Access Control**:
    *   If a command is for admins, place it in `src/commands/administrator/`.
    *   If a command is for developers, place it in `src/commands/developer/`.
    *   The system handles the permission checks automatically based on the folder.

7.  **Database & Storage**:
    *   **ORM**: We use **Sequelize** with SQLite (dev) or Postgres (prod).
    *   **Models**: Define new models in `src/data/models/`.
        *   Extend `Model<InferAttributes<T>, InferCreationAttributes<T>>`.
        *   Use `DataTypes` for schema definition.
    *   **Access**:
        *   Do not create new Sequelize instances. Use the one in `BotContext`.
        *   Create "Store" classes (like `ErrorStore`) in `src/data/` to wrap model operations.
        *   Pass these Stores to commands via `BotContext`.
    *   **Pattern**:
        ```typescript
        // 1. Define Model (src/data/models/user-model.ts)
        export class UserModel extends Model<...> { ... }
        
        // 2. Create Store (src/data/user-store.ts)
        export class UserStore {
            constructor(private model: typeof UserModel) {}
            async getUser(id: string) { return this.model.findByPk(id); }
        }

        // 3. Use in Command
        // context.userStore.getUser(interaction.user.id)
        ```

8.  **Error Handling & Scalability (CRITICAL)**:
    *   **Goal**: Provide users with a unique **Error ID** they can report, and store detailed logs in the database for debugging across multiple servers.
    *   **Pattern**: Wrap execution logic in `try/catch`.
    *   **Usage**:
        ```typescript
        import { captureError } from "../utils/error-reporter.js";

        // Inside execute(interaction, context):
        try {
            // ... logic ...
        } catch (error) {
            // 1. Capture and Log to DB
            const report = await captureError(
                context.logger,
                error,
                "command:name", // Context string
                context.errorStore,
                { // Metadata for debugging
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    args: interaction.options.data // Optional: log args
                }
            );

            // 2. Inform User with Error ID
            const response = { content: report.userMessage, ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(response);
            } else {
                await interaction.reply(response);
            }
        }
        ```

By following these guidelines, you will generate code that fits seamlessly into the existing architecture.
