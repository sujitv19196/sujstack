import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { env } from "./env"
import * as schema from "./schema"

export type Database = PostgresJsDatabase<typeof schema>

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "No database is configured. Set DATABASE_URL in your environment " +
        "(see .env.example) to connect this template to PostgreSQL.",
    )
    this.name = "DatabaseNotConfiguredError"
  }
}

let connection: postgres.Sql | undefined
let instance: Database | undefined

/** Does not open a connection. */
export function isDatabaseConfigured(): boolean {
  return env.DATABASE_URL !== undefined
}

/** Opens the connection on first use. */
export function getDb(): Database {
  if (instance) return instance
  if (!env.DATABASE_URL) throw new DatabaseNotConfiguredError()
  connection = postgres(env.DATABASE_URL, { prepare: false })
  instance = drizzle(connection, { schema })
  return instance
}

export async function closeDb(): Promise<void> {
  await connection?.end()
  connection = undefined
  instance = undefined
}

/** Defers `getDb()` until a property is actually accessed. */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const real = getDb()
    const value = Reflect.get(real, property) as unknown
    return typeof value === "function" ? value.bind(real) : value
  },
})
