import type { KeyValueStore, VectorStore } from "@sujstack/db-core"
import type { Metrics } from "@sujstack/metrics-core"
import type { BaseContext } from "@sujstack/trpc-core"
import type { Database, providers } from "../db/runtime"
import type { counters } from "../metrics/catalog"

/** What every procedure may touch. `kv` and `vectors` are typed as ports. */
export interface Context extends BaseContext {
  readonly db: Database
  readonly kv: KeyValueStore
  readonly vectors: VectorStore
  /** Whether DATABASE_URL is set. Checking it does not open a connection. */
  readonly databaseConfigured: boolean
  /** Diagnostic labels supplied by the composition root. */
  readonly providers: typeof providers
  readonly headers: Headers
  readonly metrics: Metrics<typeof counters>
  /** Signs deliveries to the demo webhook. Undefined when it is not configured. */
  readonly demoWebhookSecret: string | undefined
}
