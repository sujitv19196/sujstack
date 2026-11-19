# sujstack

Bun · Next 16 · React 19 · TypeScript 7 · Drizzle · tRPC v11 · Tailwind v4 · Biome

A template with a deliberately **provider-agnostic data layer**. Drizzle is the relational
interface, and a key/value store and vector store sit behind hand-written interfaces so the
concrete provider is swappable without touching a single call site. Nothing is connected out of
the box: the app boots, typechecks, tests and runs with no database and no credentials.

The ports and adapters live in [sujstack-kit](https://github.com/sujitv19196/sujstack-kit), mounted
here as the `kit/` submodule. The template is versioned: start an app by cloning it with history,
then take template releases with `git merge` and kit releases by bumping the submodule. The steps,
for people and agents alike, are in [AGENTS.md](AGENTS.md); what each release changed is in
[CHANGELOG.md](CHANGELOG.md).

## Quick start

```bash
git clone --recurse-submodules git@github.com:sujitv19196/sujstack.git
bun install
bun run dev          # http://localhost:3000
```

In an existing clone, `git submodule update --init` fetches `kit/`.

| Script | Does |
| --- | --- |
| `bun run dev` / `build` / `start` | the Next app |
| `bun run typecheck` | `tsc --noEmit` in every workspace package, kit included |
| `bun run check` / `check:fix` | Biome lint + format, for the app and then the kit |
| `bun test` | every test, kit included |
| `bun run db:generate` | schema → SQL migration (no connection needed) |
| `bun run db:check` | fails if migrations have drifted from the schema |
| `bun run db:migrate` / `push` / `studio` | require `DATABASE_URL` |
| `bun run metrics:rules` | catalog → `packages/server/rules.yaml` |
| `bun run metrics:check` | fails if `rules.yaml` has drifted from the catalog |
| `bun run infra:check` / `infra:fmt` | `terraform fmt` + `validate` on `infra/` (needs the Terraform CLI, no credentials) |

The home page is a tour of the stack: adapters, KV namespaces, vector search, fault handling,
alert rules and the render error boundary. It is built from `apps/next/src/app/_demo/` and the
`demo` router in `packages/server/src/trpc/routers/demo.ts`, and it also reaches into the
webhooks, the jobs, the metrics catalog and Terraform. *Removing the demo* in
[AGENTS.md](AGENTS.md) lists every piece.

## Layout

| Layer | Owner | Lives in |
| --- | --- | --- |
| **Ports** — interfaces, facades, contract suites, tRPC plumbing | kit | `kit/ports/*` |
| **Adapters** — memory, Postgres, pg-boss, console, Sentry, OTLP | kit | `kit/adapters/*` |
| **Schema and migrations** | you | `packages/db` |
| **Server** — composition roots, catalogs, routers: framework-free, shared by both apps | you | `packages/server` |
| **Shared** — code the browser and server both run: config, routes | you | `packages/shared` |
| **UI** — pages, components, the HTTP routes that call the server | you | `apps/next` |
| **Worker** — background job handlers, `/health` | you | `apps/worker` |
| **Infrastructure** — Vercel, Neon and Render projects, env vars | you | `infra/` |

Everything under `kit/` is someone else's code: change it upstream, not here. Everything under
`packages/` and `apps/` is yours. Server code lives in packages, not in the Next app, so the worker
can run it too: a job handler imports `@app/server` the same way a route handler does.

```
packages/db/                                    # @app/db
  drizzle.config.ts  migrations/
  src/schema.ts  src/types.ts                   # tables; the Database and Transaction types
packages/server/                                # @app/server: no Next, no React
  rules.yaml  scripts/rules.ts
  src/db/{runtime,env}.ts                       # composition root for data
  src/obs.ts                                    # composition root for the log
  src/metrics/{catalog,runtime}.ts              # counters, rules, composition root for metrics
  src/jobs/{catalog,runtime}.ts                 # job types and policies, composition root for the queue
  src/trpc/{init,context,runtime}.ts  routers/  # your procedures, the request context
  src/mcp/runtime.ts                            # composition root for the MCP endpoint
packages/shared/                                # @app/shared: runs in the browser and on the server
  src/config.ts  src/routes.ts
apps/next/                                      # UI, and HTTP routes that call @app/server
  components.json  src/app/  src/trpc/          # pages, route handlers, React bindings and provider
  src/components/ui/  src/lib/utils.ts          # shadcn/ui
apps/worker/
  src/index.ts                                  # composition root: worker, log, metrics, Express
  src/handlers.ts  src/server.ts                # one handler per job, /health
```

Kit packages are consumed as TypeScript source with no build step; Next compiles them via
`transpilePackages` in `apps/next/next.config.ts`, and so are the `@app/*` packages.

## The data layer

This is **Ports and Adapters** (Hexagonal Architecture). Procedures see `ctx.kv` and `ctx.vectors`
typed as the ports `KeyValueStore` and `VectorStore`. `packages/server/src/db/runtime.ts` is the
**composition root**: the only module that names an adapter or reads `DATABASE_URL`.

```ts
export const postgres = createPostgres({ url: env.DATABASE_URL, schema })
export const kv = createMemoryKv()
export const vectors = createMemoryVectorStore({ dimensions: 1536, metric: "cosine" })
```

Drizzle is deliberately *not* wrapped in a port; `createPostgres` only manages the connection, and
its `db` opens nothing until the first query.

The recommended host is **Neon**, through its pooled URL. It needs no adapter of its own: Neon is
Postgres over TCP, so `createPostgres` connects to it like any other server and
`db.transaction(...)` works. The *Postgres transactions* demo card commits and rolls back a
row to prove it, and names the Neon branch that answered.

### Swapping a provider

1. Write the adapter implementing `KeyValueStore` — in the kit if it is generally useful, or in
   `packages/server/src/db/` if it is yours alone.
2. Call it in `runtime.ts` instead of `createMemoryKv()`, and update `providers`.

There is no config union, factory or provider registry: the import is the selection, so a bad
provider is a compile error. Prove the adapter conforms by running the port's contract suite:

```ts
import { runKvContract } from "@sujstack/db-core/testing"
runKvContract("redis", () => createRedisKv(url))
```

## Observability

`packages/server/src/obs.ts` builds the `log`: the console sink in development, Sentry in
production. Sentry is inert without `SENTRY_DSN`, so the app boots uncredentialed.

```ts
log.debug|info|warn(message, fields?)
log.error(message, cause, fields?)
```

Every procedure is logged by the kit's middleware as `trpc.<path>`, so a route added to the router
needs no logging code. Severity follows the fault: `INTERNAL_SERVER_ERROR` at `error` with the
cause, every other code at `warn`. Errors that never reach a procedure (an unresolved path) are
logged by the route handler's `onError` under the flat `trpc.failed` message, because there `path`
is unvalidated client input and belongs in the fields rather than in the message.

## Metrics

Every counter and alert rule is declared in `packages/server/src/metrics/catalog.ts`, including
the ones that count tRPC calls and webhook deliveries. The kit never increments a counter: it logs
each call or delivery and hands the result to a callback, and the app maps that to its own counter:

```ts
// server/trpc/init.ts — supplied as `ctx.onCall`
export function countCalls(metrics: Metrics<typeof counters>) {
  return (call: TrpcCall) => metrics.increment("trpc.requests", { outcome: call.outcome })
}
// server/webhooks/runtime.ts
onDelivery: ({ outcome }) => metrics.increment("webhooks.received", { source: "demo", outcome }),
```

`bun run metrics:rules` compiles `rules` to `packages/server/rules.yaml`, which is committed;
`bun run metrics:check` fails when it is stale. Uploading it to the backend (`mimirtool rules load`,
`cortextool`, or the Prometheus config) is deliberately outside the code, and routing on `severity`
belongs to Alertmanager or Grafana notification policies.

In development increments print to the console. In production they are pushed over OTLP/HTTP when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set (with `OTEL_EXPORTER_OTLP_HEADERS` for credentials), and
dropped when it is not.

### Adding a counter or rule

1. Add a `defineCounter<Labels>(...)` entry to the catalog, and a rule to `rules` if it should alert.
2. Call `metrics.increment(...)` — the key and labels are type-checked against the catalog.
3. Run `bun run metrics:rules` and commit `rules.yaml`.

### UI components

shadcn/ui components live in `apps/next/src/components/ui/`; `components.json` points the shadcn
CLI there, so `bunx shadcn add <component>` works as usual. The theme is `src/app/globals.css`.

### Routes

Paths live in `packages/shared/src/routes.ts`, not inline. The tRPC endpoint in particular appears in
two places that must agree — the route handler's `endpoint` and the client link's URL — so it is
a single const. The browser uses these paths as they are. A server-side call back into the app
builds its URL with `requestOrigin(ctx.headers)`, the origin the current request arrived on, from
the `x-forwarded-host` and `x-forwarded-proto` headers that Vercel's proxy and `next dev` set, so
it is correct locally, on production and on a preview alike.

### Webhooks

The kit's `@sujstack/webhook-core` owns what every webhook shares: raw-body verification before
parsing, status codes, and a `webhook.<source>` log and `webhooks.received{source, outcome}` count per
delivery. Verifiers and handlers are yours. To add a provider:

1. Add its name to the `source` union of `webhooks.received` in the metrics catalog.
2. Write a `WebhookVerifier` in `packages/server/src/webhooks/<provider>.ts`, usually a few lines around the
   provider's SDK, and prove it with `runVerifierContract` from `@sujstack/webhook-core/testing`.
3. Wire it in `packages/server/src/webhooks/runtime.ts`, which reads its secret and counts each delivery in
   `onDelivery`, and export it as `POST` from `src/app/api/webhooks/<provider>/route.ts`.

`handle` may run twice for one event, since providers retry; `event.id` is stable, so skip repeats
with a KV check where that matters. The `demo` source signs `x-demo-signature: sha256=<hex HMAC>`.
To send one by hand in development:

```sh
body='{"id":"evt_1","type":"demo.ping"}'
sig=$(printf %s "$body" | openssl dgst -sha256 -hmac sujstack-dev-webhook-secret -hex | sed 's/.* //')
curl -i localhost:3000/api/webhooks/demo -H "x-demo-signature: sha256=$sig" -d "$body"
```

### MCP tools

`/api/mcp` serves tRPC procedures to LLM clients as MCP tools, through the kit's
`@sujstack/mcp-adapters/trpc`. A procedure is exposed only when it opts in, and opting in requires a
description, which is what the model reads to decide when to call it:

```ts
search: publicProcedure
  .meta({ mcp: { description: "Finds documents similar to the text, with scores." } })
  .input(z.object({ text: z.string() }))
  .query(...)
```

The tool is named after the path, `.` → `_` (`demo.vectorSearch` → `demo_vectorSearch`); its
input schema comes from the Zod `.input()`, and queries are marked read-only. A tool call runs the
procedure itself, with a context from the same `createContext` (`packages/server/src/trpc/runtime.ts`) the
tRPC route uses, so it is logged as `trpc.<path>`, counted in `trpc.requests`, and passes through
the procedure's own middleware. There is no MCP-specific auth: a procedure built on a
`protectedProcedure` that reads the session from the request headers is protected over MCP too, for
clients that send those headers (usually `Authorization: Bearer …`). To connect Claude Code in
development:

```sh
claude mcp add --transport http sujstack http://localhost:3000/api/mcp
```

### Background jobs

Work that outlives a request runs in `apps/worker`, a long-running Bun + Express process on Render
that takes jobs from Postgres through the kit's pg-boss adapter. The job catalog,
`packages/server/src/jobs/catalog.ts`, is the contract between the two apps: `Jobs` maps each name
to its payload, and `policies` gives each a `retryLimit` and a `timeoutSeconds`. To add a job:

1. Add its payload type to `Jobs` and its policy to `policies`.
2. Write its handler in `apps/worker/src/handlers.ts`. `handlers` is typed `JobHandlers<Jobs>`, so the
   worker does not compile until every job has one. Resolve with the output; throw to fail the
   attempt.
3. Enqueue it from a procedure. Pass `{ tx }` inside a `ctx.db.transaction` when the job depends on
   that transaction's writes, so the job exists only if they commit:

   ```ts
   await ctx.db.transaction(async (tx) => {
     await tx.insert(orders).values(order)
     await ctx.jobs.enqueue("orders.receipt", { orderId: order.id }, { tx })
   })
   ```

Each attempt is logged as `job.<name>` and counted in `jobs.processed{job, outcome}`, and the
`JobsFailing` rule fires when a job exhausts its retries. The worker creates the pg-boss schema and
every queue when it starts, so enqueueing fails until it has started once against that database.
Run it locally with `bun run worker`; it reads `apps/next/.env.local`, and serves `/health` on
:3001.

### Query defaults

TanStack Query defaults live in `apps/next/src/trpc/config.ts`. Edit `queryDefaults` to change
them app-wide, or pass `defaultOptions` to `<TRPCReactProvider>` to override one subtree. The
client is built once on mount, so changing the prop afterwards has no effect.

## Infrastructure

`infra/` declares everything the deployment needs: the Vercel project (linked to this repo), a Neon
project with a `main` branch for production and a `preview` branch shared by every preview
deployment, a Render background worker running `apps/worker` against production (off until
`worker_enabled`), and the env vars that
connect them. There are two separate loops:

| Loop | Triggered by | Does |
| --- | --- | --- |
| App deploys | `git push` | Vercel builds `main` to production and every other branch to a preview. The build runs `db:migrate` first, against that environment's database. Render redeploys the worker when a push to `main` touches a path in its build filter. |
| Infra changes | `terraform apply` in `infra/` | Creates or updates the projects and env vars. When an env var changes, it redeploys `main` through a deploy hook, since env vars only reach deployments built after they changed. |

The template runs Terraform from your machine and keeps state in a local, gitignored
`infra/terraform.tfstate`. That is enough for one person; before anyone else applies, or before
running it from CI, add a remote [backend](https://developer.hashicorp.com/terraform/language/backend)
to `infra/versions.tf` (HCP Terraform, S3, GCS, …) and run `terraform -chdir=infra init
-migrate-state`. Losing the state file means Terraform forgets what it created.

### Setting up a new deployment

Terraform cannot create the accounts it signs in with, so a repository created from this template
starts with a few manual steps. Each step uses a command where one exists and the web UI where
none does. Never create the Vercel, Neon or Render project by hand: Terraform creates them on the
first apply, and a hand-made one would collide with it. Accounts and tokens you already have from another
project can be reused.

Tools: the Terraform CLI (`brew install hashicorp/tap/terraform`).

**1. Point the code at the new project.** In `infra/variables.tf`, set `name` (what the Vercel,
Neon and Render projects are called), and give `github_repo` (`owner/name`), `neon_org_id` (from
`npx neonctl orgs list`, after step 3) and `render_owner_id` (after step 4) a `default`.

**2. Vercel** (UI only).

1. Sign up at vercel.com with **Continue with GitHub**. When it offers to import a repository, close
   that screen.
2. Let Vercel read the repository: github.com/apps/vercel → **Configure** → your account →
   *Repository access* → add the repository.
3. Create an API token: **Account Settings → Tokens → Create**, scoped to your account. Copy it;
   it is shown once.

**3. Neon** (UI only). Sign up at neon.tech, then create a **personal** API key: avatar → **Account
settings → API keys → Create new API key**, and copy it. A key created inside a project's settings
is project-scoped and cannot create projects, so the first apply fails with it.

**4. Render** (UI only).

1. Sign up at render.com with GitHub.
2. Let Render read the repository: github.com/apps/render → **Configure** → your account →
   *Repository access* → add the repository.
3. Create an API key: **Account Settings → API Keys → Create API Key**, and copy it.
4. Copy the owner ID (`tea-…` or `usr-…`) from the dashboard URL into `render_owner_id` in
   `variables.tf`.

**5. Provider tokens.** Terraform reads them from the environment of the shell that runs it:

```bash
export VERCEL_API_TOKEN=… NEON_API_KEY=… RENDER_API_KEY=…
```

Optional Terraform variables go in `infra/terraform.tfvars`, which is gitignored: `sentry_dsn`,
`otel_endpoint` and `otel_headers` turn on Sentry and metrics, and `worker_enabled = true` runs
the worker.

**6. First apply.** Push to `main` first, so Vercel has a commit to build, then apply. The apply
creates the Neon and Vercel projects and the env vars, and triggers the first production
deployment, which runs the first migration:

```bash
git push origin main
terraform -chdir=infra init
terraform -chdir=infra plan
terraform -chdir=infra apply
```

The worker is off by default. To run it, set `worker_enabled = true` in `infra/terraform.tfvars`
and apply again; then look for `worker.started` in the worker's logs in the Render dashboard.

If an apply fails on a token, fix it and apply again; Terraform resumes from what it already
created.

Change infrastructure by editing `infra/` and applying, never in the Vercel, Neon or Render
dashboards, or the next apply reverts it.

## Design decisions

The port- and adapter-level decisions — free-form log messages, the metrics catalog, typed rule
builders, error masking, vector ids and scores — are in the [kit README](kit/README.md). These are
the app-level ones.

**MCP tools are tRPC procedures, not a second API.** An LLM client and the UI want the same
operations, so rather than maintain a parallel set of MCP handlers, a procedure opts in with a
description and the kit serves it as a tool. Both routes build their context with the one
`createContext` in `packages/server/src/trpc/runtime.ts`, which is what makes the procedure's own
middleware the MCP endpoint's auth: whatever a `protectedProcedure` reads from the request, it reads
the same way from an MCP call, so there is no second permission model to drift. Opt-in rather than
expose-everything, because a tool list is a prompt: every tool the model sees costs context and is
one more thing it might call.

**Apps are clones that merge template releases.** Most templates are one-shot: create-t3-app and
TanStack's CLI scaffold an app and never touch it again, and TanStack copes by keeping the generated
code thin and everything else in versioned packages. The kit is that half here, but the app layer
(Terraform, the composition roots, the worker) is thick enough that losing its fixes matters.
So the template has releases, and an app is a clone that keeps the template's history: a release
merges with git's own three-way merge against a real common ancestor, which is what Copier and the
React Native upgrade helper rebuild by hand. A GitHub fork would do the same but allows one per
account and cannot be made private; a copy with fresh history has no common ancestor to merge
against. The template's tags are fetched under `template/`, so they never collide with the app's
own. Optional pieces are removed with a written recipe and recorded in `sujstack.json`, rather than
composed by a generator as TanStack's add-ons are: the features here share catalogs, the context
and Terraform, so a generator would be a second codebase to keep in step.

**One kit, as a submodule.** Code you own and code you are meant to edit used to share packages,
with no visible line saying "don't edit below here". The submodule is that line: `kit/` is a pinned
SHA of another repo, and an edit there shows up as a dirty submodule rather than blending into an
app diff. One kit rather than a repo per port, because the ports version together — `trpc-core`
depends on `obs-core` and `metrics-core` — and one SHA is one thing to bump.

**No factory in the kit.** A config union and a `switch` over it inside the submodule would force
you to fork the kit to add a provider. The app's composition root calls adapter constructors
directly instead, so adding a provider is an import. The exhaustiveness the switch used to give is
still there: an unknown adapter is an unresolved import, which is a compile error.

**The app composes its own base procedures.** `packages/server/src/trpc/init.ts` builds a
private `baseProcedure` from the kit's bare `procedure` and `logged` middleware, and every exported
base procedure extends it: `publicProcedure = baseProcedure`, and a `protectedProcedure` would be
`baseProcedure.use(requireAuth)`. They are siblings rather than one extending the other, because a
protected procedure is not a kind of public one — anything public-only added later (anonymous rate
limits, a CAPTCHA) must not leak into it. `logged` comes first because the first `.use` wraps the
rest, so a call rejected by auth is still logged at `warn` and counted as `client_error`; the
reverse order would hide exactly the traffic that probes the API. The masked server-fault message is the app's `GENERIC_ERROR_MESSAGE`,
passed to `createTrpc`, so the wire and the render layer say the same thing.

**`createTrpc` is generic over the app's context.** The middleware needs `log` and an `onCall`; the
procedures need everything else. `createTrpc<C extends BaseContext>()` lets the kit own the first
without knowing the second, so it never imports a type from the app. `onCall` is built by
`countCalls(metrics)` in `init.ts`, so the route handler and each test harness count calls the same
way, and a test that passes a memory sink sees exactly what production would count.

**Secrets come from the environment; topology and behavior come from code.** `DATABASE_URL` is
the only environment variable the data layer reads, because it is a per-deployment secret. Which
adapter backs a store, the vector dimensionality and the distance metric are *not* deployment
config — changing the metric or dimensions silently invalidates every vector already stored, so
they are code, in `runtime.ts`. Credentials are read at the composition root and passed in as
data, so nothing below it touches `process.env`.

**The demo webhook has a public dev secret.** Without `DEMO_WEBHOOK_SECRET`, development falls
back to a fixed secret so the demo works uncredentialed. Production has no fallback and answers 503,
because a known secret would let anyone forge a delivery. A real provider's route should have no
fallback at all.

**Neon over TCP, not its HTTP driver.** Drizzle's `neon-http` driver would save a TCP and TLS
handshake per cold function, but it has no interactive transactions: `db.transaction` throws, and
`db.batch` cannot branch on an intermediate result. Transactions are worth more than the
handshake, so Neon is reached through the pooled URL with the existing `postgres.js` adapter. The
pooler runs in transaction mode, so a transaction keeps its connection for its whole length, and
prepared statements are already off. A Neon adapter would be a new kit export beside `./postgres`,
not a replacement for it.

**Infrastructure is Terraform.** Clicking through dashboards leaves nothing to review and nothing
to rebuild from. The template ships no backend and no CI for it, because both name an account
that belongs to whoever deploys: local state gets one person running, and a team adds a remote
backend and, if it wants plans on pull requests, a workflow against it. The Neon↔Vercel
marketplace integration is deliberately not used: Terraform cannot install it, and everything it
would set is declared in `infra/` instead.

**One shared preview database.** Every preview deployment uses the `preview` Neon branch, forked
from `main` when Terraform created it. That keeps previews off production data with nothing but
Terraform. A branch per pull request would isolate previews from each other, but it needs CI to
create, wire and delete branches on PR events; add it when two open PRs start fighting over a
schema.

**Migrations run in the Vercel build.** `bun run db:migrate && bun run build` means a deploy cannot
go live against a schema it has not migrated. drizzle-kit reads `DATABASE_URL_UNPOOLED` first, so
migrations bypass the transaction-mode pooler. Migrations must therefore be backwards compatible
with the deployment still serving traffic, and a preview build migrates the shared preview branch.

**The kit is public.** Vercel clones submodules only over public HTTPS, so `.gitmodules` points at
the kit's HTTPS URL and the kit repo is public. It holds no secrets.

**Background work runs on a worker, not in Vercel.** A Vercel function is bounded to
minutes and is billed while it waits, and Vercel Workflows would tie job code to Vercel's
step-function API. A plain long-running process runs anything for as long as it takes. Render
runs it from this repo with no Dockerfile, restarts it on a crash, and is declared in `infra/`
like everything else. The worker is Express rather than bare `Bun.serve` so the routes it grows —
an admin trigger, a queue dashboard — have the ecosystem's middleware. Vercel Queues remain a
fit for short, bursty fan-out handled by functions; it would be a second `JobQueue` adapter.

**The worker runs on Render.** Render maintains its Terraform provider, which sets the start and
build commands, a monorepo build filter and the shutdown delay, so the worker is declared entirely
in `infra/` and `DATABASE_URL` flows from Neon to it without leaving Terraform. Render runs Bun
natively and clones the kit submodule. It replaced Railway, whose Terraform provider is
community-maintained and cannot set a start command, healthcheck or watch paths, and whose official
TypeScript IaC would move secrets out of Terraform. The cost is a flat $7/mo per worker, since
Render has no free tier for workers, and background workers get no healthcheck, so a deploy goes
live when the process starts rather than when `/health` answers.

**The worker is off by default.** It costs money and its polling keeps Neon from sleeping, so
`worker_enabled` defaults to `false` and a fresh template applies cleanly for free.

**Jobs ride on Postgres.** pg-boss keeps jobs in the database the app already has, so a job can be
enqueued in the same transaction as the write it depends on, and its state and output are rows
the demo card reads back. The cost is that the worker polls: Neon's compute never scales to zero
while it runs, which is roughly an always-on 0.25 CU and more than Neon's free plan includes.
Raising `pollingIntervalSeconds` in `apps/worker/src/index.ts` trims it but cannot remove it.

**Previews enqueue, but no preview worker runs.** The worker is production-only, so a job
enqueued from a preview deployment stays queued on the preview branch. A second Render
worker pointed at that branch would double the always-on cost for a demo; add one when a
preview needs to see jobs finish.

**The worker logs to stdout.** The kit's Sentry sink is built on `@sentry/nextjs` and relies on
Next's `instrumentation.ts` to initialise it, so the worker uses the console sink and Render
collects the output. Sentry for the worker needs a kit adapter on `@sentry/node` first.

## Conventions

**Schema.** Table definitions in `packages/db/src/schema.ts` are human-authored; the types
are not. `User` and `NewUser` come from Drizzle's `$inferSelect` / `$inferInsert`, so they cannot
drift from the definitions. `db:generate` turns definitions into SQL and `db:check` fails on drift.

**Comments say what non-obvious code does.** They do not argue for design decisions or explain
concepts an implementer already knows — that material belongs in this file.
