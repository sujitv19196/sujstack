import type { VectorStoreConfig } from "@sujstack/db-core"

export type KvConfig = { readonly provider: "memory" }
// | { readonly provider: "redis"; readonly url: string; readonly keyPrefix?: string }

type VectorProviderConfig = { readonly provider: "memory" }
// | { readonly provider: "pinecone"; readonly apiKey: string; readonly indexName: string }

export type VectorConfig = VectorProviderConfig & VectorStoreConfig

export type KvProvider = KvConfig["provider"]
export type VectorProvider = VectorProviderConfig["provider"]
