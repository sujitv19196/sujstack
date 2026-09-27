import { createHmac, timingSafeEqual } from "node:crypto"
import type { WebhookEvent, WebhookVerifier } from "@sujstack/webhook-core"
import { z } from "zod"

export const DEMO_SIGNATURE_HEADER = "x-demo-signature"

const deliverySchema = z.object({ id: z.string().min(1), type: z.string().min(1) })

function hmac(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
}

/** The headers a demo sender attaches to `body`. */
export function signDemo(body: string, secret: string): Headers {
  return new Headers({
    "content-type": "application/json",
    [DEMO_SIGNATURE_HEADER]: hmac(body, secret),
  })
}

function parse(body: string): unknown {
  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

/** `x-demo-signature: sha256=<hex HMAC of the raw body>`, over a JSON body with `id` and `type`. */
export function createDemoVerifier(secret: string): WebhookVerifier {
  return {
    async verify(headers, rawBody) {
      const signature = headers.get(DEMO_SIGNATURE_HEADER)
      if (signature === null) return { ok: false, reason: "missing_signature" }
      const expected = Buffer.from(hmac(rawBody, secret))
      const actual = Buffer.from(signature)
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        return { ok: false, reason: "bad_signature" }
      }
      const payload = parse(rawBody)
      const delivery = deliverySchema.safeParse(payload)
      if (!delivery.success) return { ok: false, reason: "malformed" }
      return { ok: true, event: { ...delivery.data, payload } }
    },
  }
}

/** Throws on `demo.crash`, to show a handler failure; accepts every other type. */
export async function handleDemoEvent(event: WebhookEvent): Promise<void> {
  if (event.type === "demo.crash") {
    throw new Error(`Simulated handler fault for ${event.id}: downstream-9:443 refused`)
  }
}
