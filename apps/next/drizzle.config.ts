import { defineConfig } from "drizzle-kit"

// `generate` reads the schema only; `migrate`, `push` and `studio` connect.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
})
