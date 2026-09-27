# sujstack

Bun · Next 16 · React 19 · TypeScript 7 · Drizzle · tRPC v11 · Tailwind v4 · Biome

A template with a deliberately **provider-agnostic data layer**. Drizzle is the relational
interface, and a key/value store and vector store sit behind hand-written interfaces so the
concrete provider is swappable without touching a single call site. Nothing is connected out of
the box: the app boots, typechecks, tests and runs with no database and no credentials.

The ports and adapters live in [sujstack-kit](https://github.com/sujitv19196/sujstack-kit), mounted
here as the `kit/` submodule. Fork or template this repo; take kit updates by bumping the submodule.

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
| `bun run metrics:rules` | catalog → `apps/next/rules.yaml` |
| `bun run metrics:check` | fails if `rules.yaml` has drifted from the catalog |

The home page is a tour of the stack: adapters, KV namespaces, vector search, fault handling,
alert rules and the render error boundary. It is built from `apps/next/src/app/_demo/` and the
`demo` router in `apps/next/src/server/trpc/routers/demo.ts`. Delete both, and the router's line
in `_app.ts`, to start clean.

## Layout

| Layer | Owner | Lives in |
| --- | --- | --- |
| **Ports** — interfaces, facades, contract suites, tRPC plumbing | kit | `kit/ports/*` |
| **Adapters** — memory, Postgres, console, Sentry, OTLP | kit | `kit/adapters/*` |
| **Composition roots**, schema, catalog, routers, UI, pages | you | `apps/next` |

Everything under `kit/` is someone else's code: change it upstream, not here. Everything under
`apps/next` is yours:

```
apps/next/
  drizzle.config.ts  migrations/  rules.yaml  scripts/rules.ts  components.json
  src/server/db/{schema,runtime,env}.ts         # composition root for data
  src/server/obs.ts                             # composition root for the log
  src/server/metrics/{catalog,runtime}.ts       # counters, rules, composition root for metrics
  src/server/trpc/{init,context}.ts  routers/   # your procedures
  src/trpc/                                     # React bindings and provider
  src/components/ui/  src/lib/utils.ts          # shadcn/ui
```

Kit packages are consumed as TypeScript source with no build step; Next compiles them via
`transpilePackages` in `apps/next/next.config.ts`.

## The data layer

This is **Ports and Adapters** (Hexagonal Architecture). Procedures see `ctx.kv` and `ctx.vectors`
typed as the ports `KeyValueStore` and `VectorStore`. `apps/next/src/server/db/runtime.ts` is the
**composition root**: the only module that names an adapter or reads `DATABASE_URL`.

```ts
export const postgres = createPostgres({ url: env.DATABASE_URL, schema })
export const kv = createMemoryKv()
export const vectors = createMemoryVectorStore({ dimensions: 1536, metric: "cosine" })
```

Drizzle is deliberately *not* wrapped in a port; `createPostgres` only manages the connection, and
its `db` opens nothing until the first query.

### Swapping a provider

1. Write the adapter implementing `KeyValueStore` — in the kit if it is generally useful, or in
   `apps/next/src/server/db/` if it is yours alone.
2. Call it in `runtime.ts` instead of `createMemoryKv()`, and update `providers`.

There is no config union, factory or provider registry: the import is the selection, so a bad
provider is a compile error. Prove the adapter conforms by running the port's contract suite:

```ts
import { runKvContract } from "@sujstack/db-core/testing"
runKvContract("redis", () => createRedisKv(url))
```

## Observability

`apps/next/src/server/obs.ts` builds the `log`: the console sink in development, Sentry in
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

Every counter and alert rule is declared in `apps/next/src/server/metrics/catalog.ts`, including
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

`bun run metrics:rules` compiles `rules` to `apps/next/rules.yaml`, which is committed;
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

Paths live in `apps/next/src/routes.ts`, not inline. The tRPC endpoint in particular appears in
two places that must agree — the route handler's `endpoint` and the client link's URL — so it is
a single const. `absoluteUrl()` there returns a relative URL in the browser and an absolute one
on the server, which has no origin of its own.

### Webhooks

The kit's `@sujstack/webhook-core` owns what every webhook shares: raw-body verification before
parsing, status codes, and a `webhook.<source>` log and `webhooks.received{source, outcome}` count per
delivery. Verifiers and handlers are yours. To add a provider:

1. Add its name to the `source` union of `webhooks.received` in the metrics catalog.
2. Write a `WebhookVerifier` in `src/server/webhooks/<provider>.ts`, usually a few lines around the
   provider's SDK, and prove it with `runVerifierContract` from `@sujstack/webhook-core/testing`.
3. Wire it in `src/server/webhooks/runtime.ts`, which reads its secret and counts each delivery in
   `onDelivery`, and export it as `POST` from `src/app/api/webhooks/<provider>/route.ts`.

`handle` may run twice for one event, since providers retry; `event.id` is stable, so skip repeats
with a KV check where that matters. The `demo` source signs `x-demo-signature: sha256=<hex HMAC>`.
To send one by hand in development:

```sh
body='{"id":"evt_1","type":"demo.ping"}'
sig=$(printf %s "$body" | openssl dgst -sha256 -hmac sujstack-dev-webhook-secret -hex | sed 's/.* //')
curl -i localhost:3000/api/webhooks/demo -H "x-demo-signature: sha256=$sig" -d "$body"
```

### Query defaults

TanStack Query defaults live in `apps/next/src/trpc/config.ts`. Edit `queryDefaults` to change
them app-wide, or pass `defaultOptions` to `<TRPCReactProvider>` to override one subtree. The
client is built once on mount, so changing the prop afterwards has no effect.

## Design decisions

The port- and adapter-level decisions — free-form log messages, the metrics catalog, typed rule
builders, error masking, vector ids and scores — are in the [kit README](kit/README.md). These are
the app-level ones.

**One kit, as a submodule.** Code you own and code you are meant to edit used to share packages,
with no visible line saying "don't edit below here". The submodule is that line: `kit/` is a pinned
SHA of another repo, and an edit there shows up as a dirty submodule rather than blending into an
app diff. One kit rather than a repo per port, because the ports version together — `trpc-core`
depends on `obs-core` and `metrics-core` — and one SHA is one thing to bump.

**No factory in the kit.** A config union and a `switch` over it inside the submodule would force
you to fork the kit to add a provider. The app's composition root calls adapter constructors
directly instead, so adding a provider is an import. The exhaustiveness the switch used to give is
still there: an unknown adapter is an unresolved import, which is a compile error.

**The app composes its own base procedures.** `apps/next/src/server/trpc/init.ts` builds a
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

## Conventions

**Schema.** Table definitions in `apps/next/src/server/db/schema.ts` are human-authored; the types
are not. `User` and `NewUser` come from Drizzle's `$inferSelect` / `$inferInsert`, so they cannot
drift from the definitions. `db:generate` turns definitions into SQL and `db:check` fails on drift.

**Comments say what non-obvious code does.** They do not argue for design decisions or explain
concepts an implementer already knows — that material belongs in this file.
