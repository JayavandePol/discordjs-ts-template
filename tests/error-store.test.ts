import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { initDatabase, type DatabaseConnection } from "../src/data/db.js";
import { createErrorStore, type ErrorStore } from "../src/data/error-store.js";
import { loadConfig } from "../src/config/config.js";
import { Logger } from "../src/utils/logger.js";
import * as pgSchema from "../src/data/schema/pg.js";

// SQLite: the real startup path (connect, health check, migrations) on an in-memory database
const sqliteConnection = async (): Promise<DatabaseConnection> => {
  const config = loadConfig({ DISCORD_TOKEN: "token", APPLICATION_ID: "123456789012345678", DATABASE_URL: ":memory:" });
  const connection = await initDatabase(config, new Logger("error"));
  if (!connection) throw new Error("database should be enabled");
  return connection;
};

// PostgreSQL: the real pg migrations and queries, run on PGlite (Postgres compiled to WASM)
const postgresConnection = async (): Promise<DatabaseConnection> => {
  const client = new PGlite();
  const db = drizzle(client, { schema: pgSchema });
  await migrate(db, { migrationsFolder: path.resolve("drizzle/pg") });
  // Same pg-core query builder as postgres-js; only the driver differs
  return { dialect: "postgres", db: db as never, close: () => client.close() };
};

describe.each([
  ["SQLite", sqliteConnection],
  ["PostgreSQL", postgresConnection],
])("ErrorStore (%s)", (_name, connect) => {
  let connection: DatabaseConnection;
  let store: ErrorStore;

  beforeEach(async () => {
    connection = await connect();
    store = createErrorStore(connection);
  });

  afterEach(async () => {
    await connection.close();
  });

  it("stores reports and counts occurrences per fingerprint", async () => {
    await store.record({ id: "aaaa000001", fingerprint: "fp1", context: "command:ping", message: "boom", meta: { userId: "1" } });
    await store.record({ id: "aaaa000002", fingerprint: "fp1", context: "command:ping", message: "boom", meta: { userId: "2" } });
    await store.record({ id: "bbbb000001", fingerprint: "fp2", context: "command:status", message: "other" });

    const first = await store.getById("aaaa000001");
    expect(first?.occurrences).toBe(2);
    // Each report keeps its own reporter
    expect(first?.meta?.userId).toBe("1");
    expect((await store.getById("aaaa000002"))?.meta?.userId).toBe("2");
    expect((await store.getById("bbbb000001"))?.occurrences).toBe(1);
    expect(await store.getById("missing")).toBeNull();
  });

  it("lists the newest reports first and searches by ID or context", async () => {
    await store.record({ id: "old0000001", fingerprint: "a", context: "command:ping", message: "x", createdAt: new Date(1_000) });
    await store.record({ id: "new0000001", fingerprint: "b", context: "component:error:info", message: "y", createdAt: new Date(2_000) });

    expect((await store.listLatest(10)).map((e) => e.id)).toEqual(["new0000001", "old0000001"]);
    expect((await store.search("old", 10)).map((e) => e.id)).toEqual(["old0000001"]);
    expect((await store.search("ERROR:INFO", 10)).map((e) => e.id)).toEqual(["new0000001"]);
    expect(await store.search("%", 10)).toHaveLength(2);
  });

  it("prunes reports older than the cutoff and reports how many were removed", async () => {
    await store.record({ id: "old0000001", fingerprint: "a", context: "c", message: "x", createdAt: new Date("2020-01-01") });
    await store.record({ id: "new0000001", fingerprint: "a", context: "c", message: "x" });

    expect(await store.prune(new Date("2021-01-01"))).toBe(1);
    expect((await store.listLatest(10)).map((e) => e.id)).toEqual(["new0000001"]);
  });
});
