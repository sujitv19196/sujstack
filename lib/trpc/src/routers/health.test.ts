import { expect, test } from "bun:test"
import { createKv, createVectorStore, db } from "@sujstack/db"
import { counters } from "@sujstack/metrics"
import { createMetrics } from "@sujstack/metrics-core"
import { createMemorySink as createMetricSink } from "@sujstack/metrics-core/testing"
import { createLog } from "@sujstack/obs-core"
import { createMemorySink } from "@sujstack/obs-core/testing"
import type { Context } from "../context"
import { createCallerFactory } from "../init"
import { appRouter } from "./_app"

const createCaller = createCallerFactory(appRouter)

/** `db` is a lazy Proxy, so naming it here opens no connection. */
function harness(databaseConfigured: boolean) {
  const sink = createMemorySink()
  const metricSink = createMetricSink()
  const context: Context = {
    db,
    kv: createKv({ provider: "memory" }),
    vectors: createVectorStore({ provider: "memory", dimensions: 8, metric: "cosine" }),
    databaseConfigured,
    providers: { kv: "memory", vector: "memory" },
    headers: new Headers(),
    log: createLog([sink]),
    metrics: createMetrics(counters, [metricSink]),
  }
  return { caller: createCaller(context), sink, metricSink }
}

test("a successful call is logged once, under its own route", async () => {
  const { caller, sink } = harness(true)

  await caller.health.check()

  const request = sink.written().find((record) => record.message === "trpc.health.check")
  expect(request).toMatchObject({ level: "info", fields: { type: "query", path: "health.check" } })
  expect(typeof request?.fields.durationMs).toBe("number")
})

test("an unconfigured database fails the call and is logged at error with its cause", async () => {
  const { caller, sink } = harness(false)

  await expect(caller.health.check()).rejects.toThrow()

  const failure = sink.written().find((record) => record.message === "trpc.health.check")
  expect(failure).toMatchObject({ level: "error", fields: { code: "INTERNAL_SERVER_ERROR" } })
  expect(failure?.cause).toMatchObject({ message: "DATABASE_URL is not set" })
})

test("a client fault is logged at warn, not error", async () => {
  const { caller, sink } = harness(true)

  await expect(caller.health.kvRoundTrip({ value: "" })).rejects.toThrow()

  const failure = sink.written().find((record) => record.message === "trpc.health.kvRoundTrip")
  expect(failure).toMatchObject({ level: "warn", fields: { code: "BAD_REQUEST" } })
  // The stack would point at the validator, so a client fault carries no cause.
  expect(failure).not.toHaveProperty("cause")
})

test("each resolved call counts once, labelled by outcome", async () => {
  const ok = harness(true)
  const failed = harness(false)

  await ok.caller.health.check()
  await expect(ok.caller.health.kvRoundTrip({ value: "" })).rejects.toThrow()
  await expect(failed.caller.health.check()).rejects.toThrow()

  expect(ok.metricSink.added()).toMatchObject([
    { name: "trpc.requests", labels: { outcome: "ok" }, value: 1 },
    { name: "trpc.requests", labels: { outcome: "client_error" }, value: 1 },
  ])
  expect(failed.metricSink.added()).toMatchObject([
    { name: "trpc.requests", labels: { outcome: "server_error" }, value: 1 },
  ])
})
