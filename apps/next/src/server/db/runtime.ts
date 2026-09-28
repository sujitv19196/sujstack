import { createMemoryKv } from "@sujstack/db-adapters/kv/memory"
import { createPostgres } from "@sujstack/db-adapters/postgres"
import { createMemoryVectorStore } from "@sujstack/db-adapters/vector/memory"
import { env } from "./env"
import * as schema from "./schema"

// The composition root: the only module that names a concrete provider.
// Read secrets from the environment here and pass them in as data.

/** Diagnostic labels for what is wired below. */
export const providers = { kv: "memory", vector: "memory" } as const

export const postgres = createPostgres({ url: env.DATABASE_URL, schema })
export const db = postgres.db
export type Database = typeof db
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0]

export const kv = createMemoryKv()
export const vectors = createMemoryVectorStore({ dimensions: 1536, metric: "cosine" })
