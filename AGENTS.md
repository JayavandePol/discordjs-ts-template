# AGENTS.md

Guidance for AI coding assistants working in this repository. Humans: see [README.md](README.md).

## Stack

discord.js v14, TypeScript (strict, `noUncheckedIndexedAccess`), ES modules, Node.js 22.12+, Drizzle ORM (SQLite via libSQL, or PostgreSQL), Zod, pino, Vitest, ESLint.

## Commands to run before you finish

```bash
npm run typecheck
npm run lint
npm test
```

All three must pass. CI runs them on Node 22, 24 and 26, plus `npm run build` and a check that `drizzle/` matches the schema.

## Layout

- `src/index.ts`: startup. Config, logger, client listeners, database, process error policy, login.
- `src/commands/`: one command per file. `administrator/` and `developer/` set the minimum access level.
- `src/components/{buttons,selectMenus,modals}/`: component handlers matched by customId.
- `src/events/`: `interactionCreate.ts` routes every interaction; `ready.ts`.
- `src/core/access.ts`: the only access check. `module-loader.ts` loads and validates modules; `command-publisher.ts` registers commands.
- `src/data/`: `database-url.ts` (DATABASE_URL resolution shared with `drizzle.config.ts`), `db.ts` (connect + migrate), `schema/sqlite.ts` and `schema/pg.ts`, `error-store.ts`.
- `src/utils/`: `logger.ts`, `reply.ts` (`sendEphemeral`), `error-handler.ts`, `paginator.ts`, `embeds.ts`, `user-error.ts`.
- `tests/`: Vitest. `tests/helpers/fakes.ts` has fake interactions and contexts.

## Rules

1. **ESM imports** use the `.js` extension: `import { defineSlashCommand } from "../types/Command.js";`. Use `import type` for type-only imports.
2. **Define modules with the helpers** (`defineSlashCommand`, `defineUserCommand`, `defineMessageCommand`, `defineEvent`, `defineButton`, `defineSelectMenu`, `defineModal`) and `export default` the result.
3. **Ephemeral replies** use `flags: MessageFlags.Ephemeral`, never `ephemeral: true`. Use `withResponse: true` instead of `fetchReply`, and `setContexts(...)` instead of `setDMPermission`.
4. **Never leave a promise floating.** Await it, or `void promise.catch(...)` in listeners. ESLint enforces `no-floating-promises` and `no-misused-promises`.
5. **Errors**: let unexpected errors propagate; the router reports them. Throw `UserError` for expected failures the user should read. Never `try/catch` just to swallow.
6. **Access**: put restricted commands in `administrator/` or `developer/`, or set `access`. Admin commands may set `permissions`. Don't write ad-hoc permission checks; use `checkAccess` from `core/access.ts`.
7. **Long work**: set `defer: true` or `defer: "ephemeral"` on the command, then use `editReply`.
8. **Logging**: use `context.logger` (`logger.info("message", { meta })`), not `console`. Pass errors as `{ err: error }` or as the second argument.
9. **No user content in error metadata**: don't put option values, modal text or message content into `ErrorMeta` or logs.
10. **Database changes**: edit both schemas (or remove the dialect a fork doesn't use), then run `npm run db:generate` for each dialect and commit `drizzle/`. Never create tables by hand at runtime.
11. **State**: keep durable state in the database. In-memory maps (cooldowns, throttles) reset on restart and are per process.
12. **customIds** starting with `collector:` are reserved for message collectors and are never routed to handlers.

## Templates

Slash command:

```ts
import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { defineSlashCommand } from "../types/Command.js";
import { createSuccessEmbed } from "../utils/embeds.js";

export default defineSlashCommand({
  data: new SlashCommandBuilder().setName("name").setDescription("description"),
  cooldown: 5,
  async execute(interaction, { logger }) {
    await interaction.reply({ embeds: [createSuccessEmbed("Title", "Description")], flags: MessageFlags.Ephemeral });
    logger.info("Handled /name", { user: interaction.user.id });
  },
});
```

User context menu command:

```ts
import { ApplicationCommandType, ContextMenuCommandBuilder } from "discord.js";
import { defineUserCommand } from "../types/Command.js";

export default defineUserCommand({
  data: new ContextMenuCommandBuilder().setName("User Info").setType(ApplicationCommandType.User),
  async execute(interaction) {
    await interaction.reply(`That is ${interaction.targetUser.username}.`);
  },
});
```

Button handler:

```ts
import { MessageFlags } from "discord.js";
import { defineButton } from "../../types/Component.js";

export default defineButton({
  customId: /^feature:action:.+$/,
  async execute(interaction) {
    await interaction.reply({ content: "Handled!", flags: MessageFlags.Ephemeral });
  },
});
```

Paginated list:

```ts
import { paginate } from "../utils/paginator.js";

await paginate(interaction, [page1, page2, page3], { ephemeral: true });
```
