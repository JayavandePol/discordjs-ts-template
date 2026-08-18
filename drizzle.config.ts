import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Detect active database dialect from environment
const getDialectConfig = () => {
  const url = process.env.DATABASE_URL?.toLowerCase().trim() || "";

  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return {
      dialect: "postgresql" as const,
      schema: "./src/data/schema/pg.ts",
      dbCredentials: {
        url: process.env.DATABASE_URL!,
      },
    };
  }

  if (url.startsWith("mysql://") || url.startsWith("mariadb://")) {
    return {
      dialect: "mysql" as const,
      schema: "./src/data/schema/mysql.ts",
      dbCredentials: {
        url: process.env.DATABASE_URL!,
      },
    };
  }

  // Default to SQLite
  const storage = process.env.DB_STORAGE || "./data/database.sqlite";
  return {
    dialect: "sqlite" as const,
    schema: "./src/data/schema/sqlite.ts",
    dbCredentials: {
      url: storage,
    },
  };
};

const config = getDialectConfig();

export default defineConfig({
  schema: config.schema,
  out: "./drizzle",
  dialect: config.dialect,
  dbCredentials: config.dbCredentials,
  verbose: true,
  strict: true,
});
