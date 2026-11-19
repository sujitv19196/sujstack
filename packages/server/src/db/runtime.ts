import * as schema from "@app/db/schema"
import { createMemoryKv } from "@sujstack/db-adapters/kv/memory"
import { createPostgres } from "@sujstack/db-adapters/postgres"
import { createMemoryVectorStore } from "@sujstack/db-adapters/vector/memory"
import { env } from "./env"

// The composition root: the only module that names a concrete provider.
// Read secrets from the environment here and pass them in as data.

/** Diagnostic labels for what is wired below. */
export const providers = { kv: "memory", vector: "memory" } as const

export const postgres = createPostgres({ url: env.DATABASE_URL, schema })
export const db = postgres.db
export type { Database, Transaction } from "@app/db/types"

export const kv = createMemoryKv()
export const vectors = createMemoryVectorStore({ dimensions: 1536, metric: "cosine" })
