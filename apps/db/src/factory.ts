import type { KeyValueStore, VectorMetadata, VectorStore } from "@sujstack/db-core"
import { createMemoryKv } from "./adapters/kv/memory"
import { createMemoryVectorStore } from "./adapters/vector/memory"
import type { KvConfig, VectorConfig } from "./config"

export function createKv(config: KvConfig): KeyValueStore {
  switch (config.provider) {
    case "memory":
      return createMemoryKv()
  }
}

export function createVectorStore<M extends VectorMetadata = VectorMetadata>(
  config: VectorConfig,
): VectorStore<M> {
  const { dimensions, metric } = config
  switch (config.provider) {
    case "memory":
      return createMemoryVectorStore<M>({ dimensions, metric })
  }
}
