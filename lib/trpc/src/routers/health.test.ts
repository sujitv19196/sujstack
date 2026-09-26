import { expect, test } from "bun:test"
import { createKv, createVectorStore, db } from "@sujstack/db"
import { createLog } from "@sujstack/obs-core"
import { createMemorySink } from "@sujstack/obs-core/testing"
import type { Context } from "../context"
import { createCallerFactory } from "../init"
import { appRouter } from "./_app"

const createCaller = createCallerFactory(appRouter)

/** `db` is a lazy Proxy, so naming it here opens no connection. */
function harness(databaseConfigured: boolean) {
  const sink = createMemorySink()
  const context: Context = {
    db,
    kv: createKv({ provider: "memory" }),
    vectors: createVectorStore({ provider: "memory", dimensions: 8, metric: "cosine" }),
    databaseConfigured,
    providers: { kv: "memory", vector: "memory" },
    headers: new Headers(),
    log: createLog([sink]),
  }
  return { caller: createCaller(context), sink }
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
