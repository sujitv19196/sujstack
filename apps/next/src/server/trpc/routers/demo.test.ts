import { expect, test } from "bun:test"
import { createMemoryKv } from "@sujstack/db-adapters/kv/memory"
import { createPostgres } from "@sujstack/db-adapters/postgres"
import { createMemoryVectorStore } from "@sujstack/db-adapters/vector/memory"
import { createMetrics } from "@sujstack/metrics-core"
import { createMemorySink as createMetricSink } from "@sujstack/metrics-core/testing"
import { createLog } from "@sujstack/obs-core"
import { createMemorySink } from "@sujstack/obs-core/testing"
import * as schema from "../../db/schema"
import { counters } from "../../metrics/catalog"
import type { Context } from "../context"
import { createCallerFactory } from "../init"
import { appRouter } from "./_app"

const createCaller = createCallerFactory(appRouter)

function harness() {
  const sink = createMemorySink()
  const metricSink = createMetricSink()
  const context: Context = {
    db: createPostgres({ url: undefined, schema }).db,
    kv: createMemoryKv(),
    vectors: createMemoryVectorStore({ dimensions: 64, metric: "cosine" }),
    databaseConfigured: false,
    providers: { kv: "memory", vector: "memory" },
    headers: new Headers(),
    log: createLog([sink]),
    metrics: createMetrics(counters, [metricSink]),
  }
  return { caller: createCaller(context), sink, metricSink }
}

test("stack reports the adapters without a database", async () => {
  const { caller } = harness()

  expect(await caller.demo.stack()).toMatchObject({
    database: "not configured",
    kv: "memory",
    vectorIndex: { dimensions: 64 },
  })
})

test("each fault kind is logged and counted at its own severity", async () => {
  const { caller, sink, metricSink } = harness()

  await caller.demo.fault({ kind: "none" })
  await expect(caller.demo.fault({ kind: "client" })).rejects.toThrow("Simulated client fault")
  await expect(caller.demo.fault({ kind: "server" })).rejects.toThrow()

  expect(sink.written().map((record) => record.level)).toEqual(["info", "warn", "error"])
  expect(metricSink.added().map((record) => record.labels.outcome)).toEqual([
    "ok",
    "client_error",
    "server_error",
  ])
})

test("vector search ranks the document that shares the query's words first", async () => {
  const { caller } = harness()

  const matches = await caller.demo.vectorSearch({ text: "alert rules and error ratios" })

  expect(matches).toHaveLength(3)
  expect(matches[0]?.text).toContain("alert rules")
})

test("the namespace rejects a value its schema forbids, and stores one it allows", async () => {
  const { caller } = harness()

  const rejected = await caller.demo.namespaceWrite({ name: "", visits: -1.5 })
  const stored = await caller.demo.namespaceWrite({ name: "Ada", visits: 3 })

  expect(rejected).toMatchObject({ ok: false })
  expect(stored).toEqual({ ok: true, stored: { name: "Ada", visits: 3 }, keys: ["current"] })
})
