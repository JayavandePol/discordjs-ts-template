import path from "node:path";
import { describe, it, expect } from "vitest";
import { resolveDatabase } from "../src/data/database-url.js";

const cwd = path.resolve("/srv/bot");

describe("resolveDatabase", () => {
  it("defaults to a SQLite file in ./data", () => {
    const target = resolveDatabase(undefined, cwd);
    expect(target.dialect).toBe("sqlite");
    expect(target.url).toBe(`file:${path.resolve(cwd, "data/database.sqlite")}`);
  });

  it("accepts plain paths and file: URLs for SQLite", () => {
    expect(resolveDatabase("./db/bot.sqlite", cwd).url).toBe(`file:${path.resolve(cwd, "db/bot.sqlite")}`);
    expect(resolveDatabase("file:./db/bot.sqlite", cwd).url).toBe(`file:${path.resolve(cwd, "db/bot.sqlite")}`);
    expect(resolveDatabase(String.raw`C:\db\bot.sqlite`, cwd).dialect).toBe("sqlite");
  });

  it("supports in-memory and remote libSQL databases", () => {
    expect(resolveDatabase(":memory:")).toEqual({ dialect: "sqlite", url: ":memory:" });
    expect(resolveDatabase("libsql://example.turso.io")).toEqual({ dialect: "sqlite", url: "libsql://example.turso.io" });
  });

  it("detects PostgreSQL", () => {
    expect(resolveDatabase("postgresql://user:pass@localhost:5432/bot").dialect).toBe("postgres");
    expect(resolveDatabase("postgres://localhost/bot").dialect).toBe("postgres");
  });

  it("rejects MySQL and unknown schemes instead of creating a stray SQLite file", () => {
    expect(() => resolveDatabase("mysql://localhost/bot")).toThrow("MySQL");
    expect(() => resolveDatabase("mongodb://localhost/bot")).toThrow("Unsupported");
    expect(() => resolveDatabase("sqlserver:bot")).toThrow("Unsupported");
  });
});
