import type { KvConfig, VectorConfig } from "./config"
import { createKv, createVectorStore } from "./factory"

// The composition root: the only module that names a concrete provider.
// Read secrets from the environment here and pass them in as config.

export const kvConfig: KvConfig = { provider: "memory" }

export const vectorConfig: VectorConfig = {
  provider: "memory",
  dimensions: 1536,
  metric: "cosine",
}

export const kv = createKv(kvConfig)
export const vectors = createVectorStore(vectorConfig)
