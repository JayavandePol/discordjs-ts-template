# AI Development Guidelines

This document provides an overview of the project structure and guidelines for AI assistants to generate high-quality, compatible code for this Discord.js TypeScript bot.

## Project Structure

The project is a **Discord.js v14** bot built with **TypeScript** and **ES Modules (ESM)**.

### Directory Layout (`src/`)

*   **`index.ts`**: The entry point. Initializes the client, database, and loads handlers.
*   **`sharding.ts`**: Alternative entry point for production (1000+ servers). Uses `ShardingManager`.
*   **`commands/`**: Contains slash command definitions.
    *   **`developer/`**: Commands restricted to users with the `DEV_ID` role.
    *   **`administrator/`**: Commands restricted to guild administrators.
    *   **`*`**: Other folders/files are public commands.
    *   *Note: The loader automatically derives access levels based on the folder name.*
*   **`events/`**: Contains event handlers (e.g., `ready`, `interactionCreate`).
*   **`core/`**: Core logic for the bot framework.
    *   `command-registry.ts`: Loads commands recursively from `commands/`.
    *   `command-publisher.ts`: Registers commands with the Discord API (guild or global).
    *   `event-registry.ts`: Loads and registers events from `events/`.
*   **`types/`**: TypeScript definitions.
    *   `Command.ts`: Interface for slash commands.
    *   `Event.ts`: Interface for event handlers.
    *   `Context.ts`: The `BotContext` object passed to commands/events.
    *   `ErrorMeta.ts`: Metadata shape attached to error records.
*   **`utils/`**: Utility functions.
    *   `logger.ts`: Custom JSON logger (use this instead of `console`).
    *   `error-reporter.ts`: Captures errors with a UUID, logs them, and stores to DB.
    *   `error-log.ts`: Sends error embeds to a designated error log channel.
    *   `id.ts`: Generates unique error IDs.
*   **`data/`**: Database layer (Sequelize).
    *   `sequelize.ts`: Initializes the Sequelize connection.
    *   `models/`: Database model definitions.
    *   `error-store.ts`: Store class wrapping `ErrorModel` operations.
*   **`config/`**: Configuration loading from environment variables.
*   **`scripts/`**: CLI utilities (e.g., `register-commands.ts`).

## Where to Find What

*   **Adding a Command**: Create a new `.ts` file in `src/commands/`. Use `src/types/Command.ts` as a reference.
*   **Adding an Event**: Create a new `.ts` file in `src/events/`. Use `src/types/Event.ts` as a reference.
*   **Database Models**: Defined in `src/data/models/`.
*   **Environment Variables**: Accessed via `src/config/config.ts`.
*   **Error Handling**: Utilities in `src/utils/error-reporter.ts` and storage in `src/data/error-store.ts`.
*   **Error Log Channel**: Notifications via `src/utils/error-log.ts`.
*   **Intents**: Configured in `src/index.ts` in the `Client` constructor.

## AI Behavior & Reasoning Strategy

When acting as a developer for this project, adopt the following mindset:

### 1. Problem Solving & Thinking Process
*   **Scalability First**:
    *   **Sharding**: For 1000+ servers, the bot must be sharded. Use `src/sharding.ts` as the entry point instead of `src/index.ts`.
    *   **Database**: Use **PostgreSQL** or **MySQL** for production. SQLite is only for development.
    *   **State**: Never store state in memory (variables/Maps) that needs to persist. Use the database.
*   **Traceability**: Every error must be traceable. Never swallow errors. Always use `captureError` to generate an ID and `notifyErrorLogChannel` to alert the error log channel.
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
    *   **Basic Command**:
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

3.  **Command with Subcommands**:
    *   Use `addSubcommand()` on the builder and `interaction.options.getSubcommand()` in execute:
        ```typescript
        import { SlashCommandBuilder } from "discord.js";
        import { Command } from "../types/Command.js";

        const command: Command = {
            data: new SlashCommandBuilder()
                .setName("mycommand")
                .setDescription("A command with subcommands")
                .addSubcommand(sub =>
                    sub.setName("action")
                       .setDescription("Do something")
                       .addStringOption(opt =>
                           opt.setName("input")
                              .setDescription("Some input")
                              .setRequired(true)
                       )
                ),
            async execute(interaction, context) {
                const sub = interaction.options.getSubcommand();
                if (sub === "action") {
                    const input = interaction.options.getString("input", true);
                    // handle subcommand
                }
            }
        };
        export default command;
        ```

4.  **Event Structure**:
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

5.  **Component & Modal Interactions**:
    *   All component interactions are handled in `src/events/interactionCreate.ts`.
    *   Use a namespaced custom ID convention: `feature:action:data` (e.g., `error:info:abc123`).
    *   **Error handling**: Use `handleInteractionError` — it works with buttons, select menus, modals, and any repliable interaction:
        ```typescript
        import { handleInteractionError } from "../utils/error-handler.js";

        try {
            // risky operation
        } catch (error) {
            await handleInteractionError(interaction, context, error, "button:myfeature");
        }
        ```

    #### Buttons
    *   Check for button interactions early in the handler:
        ```typescript
        if (interaction.isButton() && interaction.customId.startsWith("myfeature:")) {
            // handle button
            return;
        }
        ```
    *   Creating buttons in commands:
        ```typescript
        import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

        const button = new ButtonBuilder()
            .setCustomId("myfeature:action:somedata")
            .setLabel("Click Me")
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        await interaction.reply({ components: [row] });
        ```

    #### Select Menus (Dropdowns)
    *   Check for select menu interactions:
        ```typescript
        if (interaction.isStringSelectMenu() && interaction.customId === "myfeature:select") {
            const selected = interaction.values; // string[]
            // handle selection
            return;
        }
        ```
    *   Creating select menus in commands:
        ```typescript
        import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";

        const select = new StringSelectMenuBuilder()
            .setCustomId("myfeature:select")
            .setPlaceholder("Choose an option")
            .addOptions(
                { label: "Option 1", value: "opt1", description: "First option" },
                { label: "Option 2", value: "opt2", description: "Second option" },
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
        await interaction.reply({ components: [row], ephemeral: true });
        ```
    *   Other select menu types: `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`, `ChannelSelectMenuBuilder`, `MentionableSelectMenuBuilder`. Check with `.isUserSelectMenu()`, `.isRoleSelectMenu()`, etc.

    #### Modals
    *   Show a modal from a command or button:
        ```typescript
        import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

        const modal = new ModalBuilder()
            .setCustomId("myfeature:modal")
            .setTitle("My Form");

        const input = new TextInputBuilder()
            .setCustomId("myfeature:modal:input")
            .setLabel("Enter something")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
        await interaction.showModal(modal);
        ```
    *   Handle modal submissions:
        ```typescript
        if (interaction.isModalSubmit() && interaction.customId === "myfeature:modal") {
            const value = interaction.fields.getTextInputValue("myfeature:modal:input");
            // process the form data
            await interaction.reply({ content: `You entered: ${value}`, ephemeral: true });
            return;
        }
        ```

6.  **Logging**:
    *   **NEVER** use `console.log` or `console.error`.
    *   Use `context.logger.info()`, `context.logger.warn()`, `context.logger.error()`, etc.

7.  **Imports**:
    *   Always include the `.js` extension for local imports (e.g., `import { Command } from "../types/Command.js"`). This is required for ESM in Node.js.

8.  **Access Control**:
    *   If a command is for admins, place it in `src/commands/administrator/`.
    *   If a command is for developers, place it in `src/commands/developer/`.
    *   The system handles the permission checks automatically based on the folder.
    *   **Developer access** is checked via a **role ID** (`DEV_ID` in env). Users must have this role in the guild to use developer commands.
    *   **Admin access** is checked via the `Administrator` permission flag.

9.  **Database & Storage**:
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

        // 3. Add to BotContext (src/types/Context.ts)
        //    Add `userStore?: UserStore;` to the interface

        // 4. Initialize in src/index.ts (after sequelize.sync())
        //    const userModel = initUserModel(sequelize);
        //    const userStore = new UserStore(userModel);
        //    Then add to the context object: { ..., userStore }

        // 5. Use in Command
        // context.userStore.getUser(interaction.user.id)
        ```

10. **Error Handling (CRITICAL)**:
    *   **Central handler for slash commands**: The `interactionCreate.ts` event handler wraps every command execution in `try/catch`. If your command throws, the user automatically gets a friendly error embed with an Error ID and Contact Developer button. **You don't need to add error handling to most commands.**
    *   **For buttons, select menus, modals, and partial failures**, use the universal `handleInteractionError` utility:
        ```typescript
        import { handleInteractionError } from "../utils/error-handler.js";

        // Works with ANY repliable interaction:
        // Slash commands, buttons, select menus, modals, context menus
        try {
            // risky operation
        } catch (error) {
            await handleInteractionError(interaction, context, error, "button:confirm-purchase");
            // optionally continue with other work
        }
        ```
    *   The `contextLabel` string describes where the error came from. Use the convention `type:name`:
        *   `"command:pay"` — slash command error
        *   `"button:confirm-purchase"` — button handler error
        *   `"modal:submit-report"` — modal handler error
        *   `"select:choose-role"` — select menu error
    *   `handleInteractionError` does everything in one call:
        1. Captures the error with a UUID
        2. Stores it in the database
        3. Notifies the error log channel
        4. Replies to the user with an embed + "Contact Developer" button
        5. Handles deferred/replied interaction state automatically
        6. Won't crash the bot if the reply itself fails

## Extending the Bot

### Adding a New Environment Variable

1.  Add the variable to `.env.example` with a descriptive comment.
2.  Add the field to the `Config` type in `src/config/config.ts`.
3.  Parse and assign it in the `loadConfig()` function.

### Adding a New Feature with Database Storage

1.  Create model in `src/data/models/` (e.g., `user-model.ts`).
2.  Create store in `src/data/` (e.g., `user-store.ts`).
3.  Add store to `BotContext` interface in `src/types/Context.ts`.
4.  Initialize model and store in `src/index.ts` (after `sequelize.sync()`).
5.  Use via `context.yourStore` in commands.

### Adding Intents

*   Intents are configured in `src/index.ts` in the `Client` constructor.
*   The bot currently uses `GatewayIntentBits.Guilds`.
*   If a new feature needs `GuildMessages`, `GuildMembers`, etc., add them to the intents array.
*   **Privileged intents** (`GuildMembers`, `GuildPresences`, `MessageContent`) require enabling in the [Discord Developer Portal](https://discord.com/developers/applications) under Bot > Privileged Gateway Intents.

## Common Pitfalls

*   **Don't use `console.log`** — always use `context.logger`.
*   **Don't forget `.js` extensions** on local imports — ESM requires them.
*   **Don't store state in variables** — it won't survive shard restarts. Use the database.
*   **Don't create new Sequelize instances** — use the one from `BotContext`.
*   **Always handle deferred/replied state** — before sending error responses, check `interaction.deferred || interaction.replied`.
*   **Don't swallow errors** — always `captureError` + `notifyErrorLogChannel` so nothing is silently lost.

## Naming Conventions

*   **Command files**: `kebab-case.ts` (e.g., `my-command.ts`)
*   **Model files**: `kebab-case.ts` with `PascalCaseModel` class (e.g., `user-model.ts` → `UserModel`)
*   **Store files**: `kebab-case.ts` with `PascalCaseStore` class (e.g., `user-store.ts` → `UserStore`)
*   **Event files**: `camelCase.ts` matching the event name (e.g., `interactionCreate.ts`, `guildMemberAdd.ts`)
*   **Type files**: `PascalCase.ts` (e.g., `Command.ts`, `Context.ts`)

By following these guidelines, you will generate code that fits seamlessly into the existing architecture.
