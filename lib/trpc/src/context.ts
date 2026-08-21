import type { Database, KvProvider, VectorProvider } from "@sujstack/db"
import type { KeyValueStore, VectorStore } from "@sujstack/db-core"

/** What every procedure may touch. `kv` and `vectors` are typed as ports. */
export interface Context {
  readonly db: Database
  readonly kv: KeyValueStore
  readonly vectors: VectorStore
  /** Whether DATABASE_URL is set. Checking it does not open a connection. */
  readonly databaseConfigured: boolean
  /** Diagnostic labels supplied by the composition root. */
  readonly providers: {
    readonly kv: KvProvider
    readonly vector: VectorProvider
  }
  readonly headers: Headers
}

/** Implemented by the application. See apps/next/src/app/api/trpc/[trpc]/route.ts. */
export type CreateContext = (opts: { readonly headers: Headers }) => Promise<Context> | Context
