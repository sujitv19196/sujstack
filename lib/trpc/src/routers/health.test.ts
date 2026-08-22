import { expect, test } from "bun:test"
import { createKv, createVectorStore, db } from "@sujstack/db"
import { events } from "@sujstack/obs"
import { createLog } from "@sujstack/obs-core"
import { createMemorySink } from "@sujstack/obs-core/testing"
import type { Context } from "../context"
import { createCallerFactory } from "../init"
import { appRouter } from "./_app"

const createCaller = createCallerFactory(appRouter)

/** `db` is a lazy Proxy, so naming it here opens no connection. */
function harness() {
  const sink = createMemorySink()
  const context: Context = {
    db,
    kv: createKv({ provider: "memory" }),
    vectors: createVectorStore({ provider: "memory", dimensions: 8, metric: "cosine" }),
    databaseConfigured: false,
    providers: { kv: "memory", vector: "memory" },
    headers: new Headers(),
    log: createLog(events, [sink]),
  }
  return { caller: createCaller(context), sink }
}

test("a successful call is logged once, under its own route key", async () => {
  const { caller, sink } = harness()

  await caller.health.check()

  const request = sink.written().find((record) => record.key === "trpc.health.check")
  expect(request).toMatchObject({ level: "info", fields: { type: "query", path: "health.check" } })
  expect(typeof request?.fields.durationMs).toBe("number")
})

test("an unconfigured database is a debug note, not a warning", async () => {
  const { caller, sink } = harness()

  await caller.health.check()

  expect(sink.written().find((record) => record.key === "db.unconfigured")).toMatchObject({
    level: "debug",
    message: "A query ran with no DATABASE_URL set",
  })
})

test("a client fault is logged at warn, not error", async () => {
  const { caller, sink } = harness()

  await expect(caller.health.kvRoundTrip({ value: "" })).rejects.toThrow()

  const failure = sink.written().find((record) => record.key === "trpc.health.kvRoundTrip")
  expect(failure).toMatchObject({ level: "warn", fields: { code: "BAD_REQUEST" } })
  // The stack would point at the validator, so a client fault carries no cause.
  expect(failure).not.toHaveProperty("cause")
})
