import { expect, test } from "bun:test"
import { handlers } from "./handlers"

const attempt = { id: "job-1", attempt: 1, final: false }

test("demo.sleep returns what it slept", async () => {
  expect(await handlers["demo.sleep"]({ ms: 1, fail: false }, attempt)).toMatchObject({
    sleptMs: 1,
  })
})

test("demo.sleep throws when asked to fail, naming the attempt", async () => {
  await expect(handlers["demo.sleep"]({ ms: 1, fail: true }, attempt)).rejects.toThrow("attempt 1")
})
