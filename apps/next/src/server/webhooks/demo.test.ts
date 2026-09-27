import { expect, test } from "bun:test"
import { runVerifierContract } from "@sujstack/webhook-core/testing"
import { createDemoVerifier, handleDemoEvent, signDemo } from "./demo"

runVerifierContract("demo", {
  verifier: createDemoVerifier("secret"),
  body: JSON.stringify({ id: "evt_1", type: "demo.ping" }),
  sign: (body) => signDemo(body, "secret"),
})

test("a delivery signed with another secret is rejected", async () => {
  const body = JSON.stringify({ id: "evt_1", type: "demo.ping" })

  expect(await createDemoVerifier("secret").verify(signDemo(body, "other"), body)).toEqual({
    ok: false,
    reason: "bad_signature",
  })
})

test("a signed body without an id is malformed", async () => {
  const body = JSON.stringify({ type: "demo.ping" })

  expect(await createDemoVerifier("secret").verify(signDemo(body, "secret"), body)).toEqual({
    ok: false,
    reason: "malformed",
  })
})

test("demo.crash makes the handler throw", async () => {
  await expect(handleDemoEvent({ id: "evt_1", type: "demo.crash", payload: {} })).rejects.toThrow()
})
