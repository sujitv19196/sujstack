import { defineConfig } from "drizzle-kit"

// `generate` reads the schema only; `migrate`, `push` and `studio` connect, bypassing the pooler
// when an unpooled URL is set.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
})
