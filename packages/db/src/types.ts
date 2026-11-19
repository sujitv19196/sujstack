import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import type * as schema from "./schema"

/** The app's Drizzle database, typed by its schema; the instance is made in the server's runtime. */
export type Database = PostgresJsDatabase<typeof schema>
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]
