---
name: add-job
description: Add a background job to a sujstack app - catalog entry, retry policy, worker handler, and enqueueing it from a procedure. Use when work should run outside a request (emails, digests, slow API calls, retries).
---

Follow *Background jobs* in `README.md`. In short:

1. `packages/server/src/jobs/catalog.ts`: add the payload to `Jobs` and a `{ retryLimit, timeoutSeconds }`
   to `policies`. Name it `<area>.<verb>`; payloads are plain JSON.
2. `apps/worker/src/handlers.ts`: add the handler; the file does not compile until it exists.
   Resolve with the output, throw to fail the attempt. Handlers can run more than once, so make
   them idempotent. Keep the handler a line: put the work in `packages/server` (it can use the
   database, the routers and the composition roots there) and import it from `@app/server/...`.
   Test it in `apps/worker/src/handlers.test.ts`.
3. Enqueue from a procedure with `ctx.jobs.enqueue(name, payload)`. When the job depends on rows
   written in the same request, enqueue inside `ctx.db.transaction` with `{ tx }`.

Attempts are logged as `job.<name>` and counted in `jobs.processed` with no extra code. Locally,
`bun run worker` runs the handlers and must have started once against the database before enqueueing
works. In production the worker is off until the `worker_enabled` Terraform variable is `true`.
