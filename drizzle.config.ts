import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { resolveDatabase } from "./src/data/database-url.js";

// Same DATABASE_URL resolution as the bot (src/data/database-url.ts), so drizzle-kit and the
// bot always use the same database. Each dialect keeps its own migrations folder.
const target = resolveDatabase(process.env.DATABASE_URL);

export default target.dialect === "postgres"
  ? defineConfig({
      dialect: "postgresql",
      schema: "./src/data/schema/pg.ts",
      out: "./drizzle/pg",
      dbCredentials: { url: target.url },
      verbose: true,
      strict: true,
    })
  : defineConfig({
      dialect: target.url.startsWith("file:") || target.url === ":memory:" ? "sqlite" : "turso",
      schema: "./src/data/schema/sqlite.ts",
      out: "./drizzle/sqlite",
      dbCredentials: { url: target.url, authToken: process.env.DATABASE_AUTH_TOKEN },
      verbose: true,
      strict: true,
    });
