import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// Same precedence as Next.js: loadEnvFile never overwrites a variable that is already set.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Migrations take advisory locks and run DDL, which Neon's pooled (PgBouncer) endpoint doesn't support reliably.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./drizzle",
  dbCredentials: { url },
});
