import { createWebhookHandler } from "@sujstack/webhook-core"
import { metrics } from "../metrics/runtime"
import { log } from "../obs"
import { createDemoVerifier, handleDemoEvent } from "./demo"

// The composition root for webhooks: the only module that names a verifier or reads its secret.

const production = process.env.NODE_ENV === "production"

/** Unset in production, the demo endpoint answers 503. */
export const demoWebhookSecret =
  process.env.DEMO_WEBHOOK_SECRET ?? (production ? undefined : "sujstack-dev-webhook-secret")

const notConfigured = async () => Response.json({ error: "not_configured" }, { status: 503 })

export const webhooks = {
  demo:
    demoWebhookSecret === undefined
      ? notConfigured
      : createWebhookHandler({
          source: "demo",
          verifier: createDemoVerifier(demoWebhookSecret),
          log,
          handle: handleDemoEvent,
          onDelivery: ({ outcome }) =>
            metrics.increment("webhooks.received", { source: "demo", outcome }),
        }),
}
