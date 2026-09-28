import { afterEach, expect, test } from "bun:test"
import type { Server } from "node:http"
import { createServer } from "./server"

let server: Server | undefined

afterEach(() => {
  server?.close()
})

async function health(healthy: boolean) {
  server = createServer({ healthy: async () => healthy }).listen(0)
  await new Promise((resolve) => server?.once("listening", resolve))
  const address = server.address()
  if (address === null || typeof address === "string") throw new Error("no port")
  const response = await fetch(`http://localhost:${address.port}/health`)
  return { status: response.status, body: await response.json() }
}

test("/health is 200 while the worker is healthy", async () => {
  expect(await health(true)).toEqual({ status: 200, body: { ok: true } })
})

test("/health is 503 when it is not", async () => {
  expect(await health(false)).toEqual({ status: 503, body: { ok: false } })
})
