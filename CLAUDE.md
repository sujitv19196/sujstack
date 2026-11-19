# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Starting an app from this template, what an app may edit, and upgrading it to a newer template
release are in `AGENTS.md`.

## Commands

```bash
bun install
bun run dev                 # Next app on :3000
bun run worker              # apps/worker on :3001, reading apps/next/.env.local (needs DATABASE_URL)
bun run build               # production build; also the fastest full integration check
bun run typecheck           # tsc --noEmit in every workspace package
bun run check               # Biome lint + format (read-only)
bun run check:fix           # Biome, writing fixes — run this before finishing
bun test                    # every test
bun test kit/ports/obs-core  # one package
bun test path/to/file.test.ts
bun test -t "regex"         # one test by name
bun run db:generate         # schema → SQL migration (no connection needed)
bun run db:check            # fails if migrations have drifted from the schema
bun run db:migrate | db:push | db:studio   # require DATABASE_URL
bun run metrics:rules       # catalog → packages/server/rules.yaml (commit it)
bun run metrics:check       # fails if rules.yaml has drifted from the catalog
bun run infra:check         # terraform fmt -check + validate (needs the terraform CLI, no credentials)
bun run infra:fmt           # terraform fmt, writing fixes
```

There is **no build step for kit or app packages**. They are consumed as TypeScript source and
compiled by Next via `transpilePackages` in `apps/next/next.config.ts` — a new kit package or a new
`packages/*` package must be added to that array or the app will fail to compile it. The worker
runs them from source with Bun.

Server code goes in `packages/server`, never in `apps/next`: the worker runs job handlers, and a
handler needs the same database, routers and composition roots as a request does. `apps/next`
holds what only Next can run (pages, components, route handlers that call `@app/server`).

## Kit

`kit/` is the `sujstack-kit` repo mounted as a git submodule. It holds every port and adapter, and
it has its own `CLAUDE.md`, `README.md`, `package.json`, `biome.json` and `tsconfig.base.json`
(the root `tsconfig.base.json` just extends it).

**Never edit `kit/` as part of an app change.** An edit there is a commit in the kit repo: make it
inside `kit/`, run `bun run typecheck && bun test && bun run check` there, commit and push to
the kit's remote first, then commit the SHA bump in this repo. If an app change seems to need a
kit change, stop and say so.

**Pin `kit/` to a release tag**, never an untagged commit. To update: `git -C kit fetch --tags`,
`git -C kit checkout vX.Y.Z`, run the full verify loop, then commit the pointer as
`chore: bump kit to vX.Y.Z`. `git -C kit describe --tags` shows which release is pinned.

## Template releases

This applies to the template repo only, not to an app made from it. The template version is
`version` in the root `package.json`, and `CHANGELOG.md` says what each release changed. Every
release pins `kit/` to a kit tag. To release: rename `## Unreleased` in `CHANGELOG.md` to
`## X.Y.Z`, writing *Upgrade notes* for any manual step an app needs (a new env var, a moved file,
a Terraform change), and commit it; then `bun pm version patch|minor` (commits and tags `vX.Y.Z`) and
`git push --follow-tags`. `0.x` while the template settles: anything that needs an upgrade note
bumps the minor.

## Architecture

Bun workspaces (`apps/*`, `kit/ports/*`, `kit/adapters/*`). The organising idea is **Ports and
Adapters**, with a physical boundary between code the kit owns and code the app owns.

| Package | Role |
| --- | --- |
| `kit/ports/db-core` | Port. `KeyValueStore`, `VectorStore`, contract suites. Zero runtime dependencies. |
| `kit/ports/obs-core` | Port. `EventSink` + the `createLog` facade. Zero runtime dependencies. |
| `kit/ports/metrics-core` | Port. `MetricSink`, typed counters, `createMetrics`, rule builders. Zero runtime dependencies. |
| `kit/ports/trpc-core` | `createTrpc<Context, Meta>()`: error mask, bare `procedure`, `logged` middleware, `TrpcCall`. |
| `kit/ports/webhook-core` | `WebhookVerifier`, logged `createWebhookHandler`, `WebhookDelivery`, `runVerifierContract`. No adapters. |
| `kit/ports/jobs-core` | `JobQueue`, `JobWorker`, `loggedHandlers`, `JobRun`, `runJobsContract`. |
| `kit/adapters/db` | `@sujstack/db-adapters`: `./kv/memory`, `./vector/memory`, `./postgres`. |
| `kit/adapters/obs` | `@sujstack/obs-adapters`: `./console`, `./sentry`. |
| `kit/adapters/metrics` | `@sujstack/metrics-adapters`: `./console`, `./otlp`. |
| `kit/adapters/jobs` | `@sujstack/jobs-adapters`: `./memory`, `./pg-boss`. |
| `kit/adapters/mcp` | `@sujstack/mcp-adapters`: `./trpc` — `createMcpHandler`, `McpMeta`. No port, like Drizzle. |
| `packages/db` | `@app/db`: the schema (`src/schema.ts`), the `Database` / `Transaction` types, drizzle-kit migrations and the `db:*` scripts. |
| `packages/server` | `@app/server`: everything server-side and framework-free — composition roots, catalogs, tRPC init / context / routers, MCP, webhooks. Both apps import it: Next's route handlers and the worker's job handlers. |
| `packages/shared` | `@app/shared`: code both the browser and the server run (`config`, `routes`). No dependencies. |
| `apps/next` | The UI: pages, components, the React tRPC bindings, and route handlers that call `@app/server`. No server logic of its own. |
| `apps/worker` | Long-running Bun + Express process on Render, off until `worker_enabled`: runs job handlers from pg-boss, serves `/health`. Runs from source, no build step. |
| `infra/` | Terraform: the Vercel project, Neon project and branches, the Render worker, and every deployed env var. Planned on PR and applied on merge by `.github/workflows/infra.yml`, remotely in HCP Terraform. Never change these in a dashboard. A new env var the app reads must be added here too. |

The `-core` packages hold interfaces only, and the arrow is **enforced by `package.json`**: they do
not list an adapter package as a dependency, so code holding a port physically cannot reach a
provider. The composition roots are in `packages/server/src`: `db/runtime.ts`, `obs.ts`,
`metrics/runtime.ts`, `webhooks/runtime.ts`, `jobs/runtime.ts`, `trpc/runtime.ts`
(`createContext`) and `mcp/runtime.ts`, plus
`apps/worker/src/index.ts` — the only modules that name a concrete adapter, read `process.env`,
and own the singletons.

Adding a provider means: write the adapter, then call it in the composition root. There is
deliberately **no config union, no factory and no provider registry** — the import is the
selection, so an unknown provider is a compile error. `providers` in `db/runtime.ts` is only a
diagnostic label.

Drizzle is deliberately *not* wrapped in a port (it already abstracts the SQL dialect).
`createPostgres({ url, schema })` in `@sujstack/db-adapters/postgres` returns a lazy `Proxy` as
`db`, so creating it never opens a connection; the first *query* throws if `url` was `undefined`.

The app's tRPC `Context` (`packages/server/src/trpc/context.ts`) extends the kit's `BaseContext`
(`log`, `onCall`); `createContext` in `trpc/runtime.ts` supplies `onCall: countCalls(metrics)` from `init.ts`.
`packages/server/src/trpc/init.ts` calls `createTrpc<Context>()` and composes
a private `baseProcedure = t.procedure.use(t.logged)`. Every exported base procedure is built there
by extending `baseProcedure` (`publicProcedure = baseProcedure`,
`protectedProcedure = baseProcedure.use(requireAuth)`) — siblings, not one extending the other, and
never from the bare `procedure`, or its calls go unlogged and uncounted. `logged` must stay the
first `.use`, so auth rejections are logged and counted too. The kit never imports a type from the app — preserve this.

### Observability

There is no event catalog. The message is a free-form string chosen by the caller; keep it static
and put the variable part in `fields`, so the backend can group on it.

```ts
log.debug|info|warn(message, fields?)
log.error(message, cause, fields?)   // cause is REQUIRED and comes BEFORE fields
```

The tRPC middleware logs every procedure as `trpc.<path>`.

Severity follows the fault, and this split is deliberate: `INTERNAL_SERVER_ERROR` logs at `error`
with the cause, every other tRPC code at `warn`. Logging bad client input at error level is the
flood the module exists to prevent. Errors that never reach a procedure are logged by `onError` in
the route handler under the flat `trpc.failed` key, because there `path` is unvalidated client input
and must stay in the fields — never in the message.

`error()` requires its cause and passes it through **raw**; Sentry needs the live `Error` to parse
the stack and fingerprint on it. Do not serialize it in the facade.

Alerting is not modelled in code. Sentry is inert without a DSN, so the app boots uncredentialed.
`@sujstack/obs-core/testing` exports `createMemorySink` for asserting what code logged.

### Metrics

Unlike logs, metrics **do** have a catalog: `packages/server/src/metrics/catalog.ts` declares every
counter and every alert rule, including `trpc.requests` and `webhooks.received`. The kit never
increments: it hands each call or delivery to a callback (`ctx.onCall`, `onDelivery`) and the app
counts it there. Labels are a type parameter;
a label typed as plain `string` is a compile error, which is the cardinality guard. Rules reference
counters, never name strings, and compile to `packages/server/rules.yaml` — after changing the catalog,
run `bun run metrics:rules` and commit the file. `promName` in
`kit/ports/metrics-core/src/counter.ts` owns the OTLP → Prometheus name translation. `countCalls`
in `trpc/init.ts` counts `trpc.requests{outcome}` for every call that reached a procedure.

### Jobs

`packages/server/src/jobs/catalog.ts` declares every job: `Jobs` (name → payload) and `policies`
(`retryLimit`, `timeoutSeconds`). `ctx.jobs` enqueues (pass `{ tx }` inside `ctx.db.transaction` to
make the job commit with the write); `apps/worker/src/handlers.ts` must have a handler for every
name or it does not compile. The worker wraps handlers in `loggedHandlers` (`job.<name>`) and
counts each attempt in `jobs.processed`. Its `DATABASE_URL` must be a direct connection, never the
pooler. Queues are created only by the worker on start, so enqueueing fails until it has run once.

### MCP

`/api/mcp` serves every procedure whose meta sets `mcp` as a tool:
`.meta({ mcp: { description } })`, where the description is required and written for the model. The
tool name is the path with `.` → `_`; the handler throws at startup on a collision, a chained or
non-object `.input()`. A call runs the real procedure with the same `createContext` as the tRPC
route, so it is logged, counted and authorised by the procedure's own middleware — there is no
separate MCP auth, and none should be added. Server faults are masked in the adapter, because
`errorFormatter` never sees this path.

### Errors across the wire

`errorFormatter` in `kit/ports/trpc-core/src/create-trpc.ts` replaces an `INTERNAL_SERVER_ERROR`'s
message and strips its stack, so neither reaches the browser while the server keeps both in the log.
Client faults keep their message, which the caller needs. `apps/next` also masks at render via
`GENERIC_ERROR_MESSAGE` (the same string is passed to `createTrpc`), but that alone would hide a server fault from the user and not from the
network tab.

## Conventions

- **Rationale lives in `README.md`, not in comments.** Comments say what non-obvious code *does*, in
  one terse line. Most functions have none. When you make a design decision, add a paragraph to the
  README's *Design decisions* section rather than arguing it in a code comment — `kit/README.md`
  for a port or adapter decision, the root `README.md` for an app-level one.
- **Biome, not ESLint/Prettier** (`eslint-config-next` bundles `typescript-eslint`, whose peer range
  excludes TS 7). Double quotes, **no semicolons**, 100 columns, 2-space indent.
- Port and adapter conventions (closure factories, contract suites, optional arguments) are in
  `kit/CLAUDE.md`.
- `exactOptionalPropertyTypes` is on, so a surviving optional means "absent", never "present and
  undefined" — build records with `...(x !== undefined && { x })` rather than assigning `undefined`.
- **Secrets come from the environment; topology and behaviour come from code.** Adapter selection,
  vector dimensions and distance metric live in `runtime.ts`, not in env vars. Credentials are read
  at the composition root and passed down as data, so nothing below it touches `process.env`.
- Table definitions in `packages/db/src/schema.ts` are human-authored; their types are not
  (`$inferSelect`), so they cannot drift.
- `bun test` does **not** typecheck. Type-level assertions need `@ts-expect-error` in a file that
  `bun run typecheck` sees.
- `apps/next/next-env.d.ts` is generated and flips between `.next/types` and `.next/dev/types`
  depending on whether `build` or `dev` ran last. Leave it out of diffs.

## Verifying

`bun run typecheck && bun test && bun run check` is the fast loop, but none of it exercises the app.
For anything touching tRPC, logging, or error handling, run `bun run dev` and drive it with `curl`:
a passing typecheck will not tell you that a client fault logged at the wrong severity, that an
unresolved path double-logged, or that an error message leaked across the wire.
