import { expect, test } from "bun:test"
import { createLog } from "./log"
import type { EventSink } from "./sink"
import { createMemorySink } from "./testing/memory"

const events = {
  "test.thing": { message: "a test event" },
} satisfies Record<string, { message: string }>

test("every sink receives the record, carrying the catalog message", () => {
  const first = createMemorySink()
  const second = createMemorySink()

  createLog(events, [first, second]).info("test.thing", { count: 1 })

  expect(first.written()).toMatchObject([
    { key: "test.thing", message: "a test event", level: "info", fields: { count: 1 } },
  ])
  expect(second.written()).toHaveLength(1)
})

test("an unknown key falls back to the key as its message", () => {
  const sink = createMemorySink()

  createLog(events, [sink]).info("trpc.health.check")

  expect(sink.written()[0]).toMatchObject({
    key: "trpc.health.check",
    message: "trpc.health.check",
  })
})

test("a non-error record carries no cause property at all", () => {
  const sink = createMemorySink()

  createLog(events, [sink]).warn("test.thing")

  expect(sink.written()[0]).not.toHaveProperty("cause")
})

test("a throwing sink neither stops the next one nor flattens the cause", () => {
  const working = createMemorySink()
  const broken: EventSink = {
    write() {
      throw new Error("sink is down")
    },
  }
  const boom = new Error("outer", { cause: new Error("inner") })

  createLog(events, [broken, working]).error("test.thing", boom)

  expect(working.written()[0]?.cause).toBe(boom)
})
