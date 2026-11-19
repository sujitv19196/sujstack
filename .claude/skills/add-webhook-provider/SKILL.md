---
name: add-webhook-provider
description: Receive webhooks from a new provider (Stripe, GitHub, Clerk, ...) in a sujstack app - verifier, handler, route, secret and metrics label. Use when an external service needs to call the app.
---

Follow *Webhooks* in `README.md`. In short:

1. Add the provider to the `source` union of `webhooks.received` in
   `packages/server/src/metrics/catalog.ts`.
2. Write a `WebhookVerifier` in `packages/server/src/webhooks/<provider>.ts`, usually a few lines
   around the provider's SDK, and prove it with `runVerifierContract` from
   `@sujstack/webhook-core/testing`.
3. Wire it in `packages/server/src/webhooks/runtime.ts` with `createWebhookHandler`, counting each
   delivery in `onDelivery`, and export it as `POST` from
   `apps/next/src/app/api/webhooks/<provider>/route.ts`. Add the path to `packages/shared/src/routes.ts`.
4. The signing secret is a new env var: use the `add-env-var` skill.

Providers retry, so `handle` can see one event twice; `event.id` is stable, so skip repeats with a KV
check where that matters.
