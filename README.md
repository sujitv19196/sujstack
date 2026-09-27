# sujstack

Bun · Next 16 · React 19 · TypeScript 7 · Drizzle · tRPC v11 · Tailwind v4 · Biome

A template with a deliberately **provider-agnostic data layer**. Drizzle is the relational
interface, and a key/value store and vector store sit behind hand-written interfaces so the
concrete provider is swappable without touching a single call site. Nothing is connected out of
the box: the app boots, typechecks, tests and runs with no database and no credentials.

## Quick start

```bash
bun install
bun run dev          # http://localhost:3000
```

| Script | Does |
| --- | --- |
| `bun run dev` / `build` / `start` | the Next app |
| `bun run typecheck` | `tsc --noEmit` in every workspace package |
| `bun run check` / `check:fix` | Biome lint + format |
| `bun test` | port contract suites |
| `bun run db:generate` | schema → SQL migration (no connection needed) |
| `bun run db:check` | fails if migrations have drifted from the schema |
| `bun run db:migrate` / `push` / `studio` | require `DATABASE_URL` |
| `bun run metrics:rules` | catalog → `apps/metrics/rules.yaml` |
| `bun run metrics:check` | fails if `rules.yaml` has drifted from the catalog |

## Layout

| Package | Role |
| --- | --- |
| `lib/db-core` — `@sujstack/db-core` | **Ports.** Interfaces only. No third-party runtime dependencies. |
| `apps/db` — `@sujstack/db` | **Adapters**, Drizzle schema, and the composition root. |
| `lib/obs-core` — `@sujstack/obs-core` | **Port.** One event sink. Interfaces only. No third-party runtime dependencies. |
| `apps/obs` — `@sujstack/obs` | **Adapters** and the composition root. |
| `lib/metrics-core` — `@sujstack/metrics-core` | **Port.** Counter sink, typed counters, alert-rule builders. No third-party runtime dependencies. |
| `apps/metrics` — `@sujstack/metrics` | **Adapters**, the counter + rule catalog, and the composition root. |
| `lib/trpc` — `@sujstack/trpc` | Router, context, React bindings. |
| `lib/ui` — `@sujstack/ui` | Tailwind v4 theme + shadcn/ui components. |
| `apps/next` — `@sujstack/next` | The application. |

Packages are consumed as TypeScript source with no build step; Next compiles them via
`transpilePackages`.

## The data layer

This is **Ports and Adapters** (Hexagonal Architecture):

- A **port** names a capability in the application's vocabulary — `KeyValueStore`, `VectorStore`.
  Ports live in `@sujstack/db-core` and know nothing about any provider.
- An **adapter** is one technology's answer to a port — `createMemoryKv`. Adapters live in
  `@sujstack/db`, which depends on `@sujstack/db-core`. The arrow only points one way, and it is enforced
  by `package.json`: `@sujstack/db-core` does not list `@sujstack/db` as a dependency, so application code
  importing a port physically cannot reach a concrete provider.
- The **composition root** (`apps/db/src/runtime.ts`) is the only module in the repository that
  names a provider.

Drizzle is deliberately *not* wrapped in a hand-written port. It already abstracts the SQL
dialect; putting another interface in front of it would be an abstraction over an abstraction.

### Swapping a provider

1. Write the adapter in `apps/db/src/adapters/kv/redis.ts` implementing `KeyValueStore`.
2. Add a member to the union in `apps/db/src/config.ts` and a `case` in `apps/db/src/factory.ts`.
3. Point the composition root at it.

There is no runtime provider registry and no "unknown provider" error, because a bad provider is
a **compile error**. Forgetting the new `case` fails to build too, thanks to exhaustive switching.

Prove the adapter conforms by running the port's own contract suite against it:

```ts
import { runKvContract } from "@sujstack/db-core/testing"
runKvContract("redis", () => createRedisKv(url))
```

The contract suites live with the ports because they are the executable specification of what a
port means.

## Observability

The same ports and adapters split, one layer up. `lib/obs-core` owns the `EventSink` port and the
`createLog` facade; `apps/obs` owns the adapters and the composition root.

```ts
log.debug|info|warn(message, fields?)
log.error(message, cause, fields?)
```

The message is a free-form string chosen by the caller. Keep it static and put the variable part in
`fields` (`Record<string, unknown>`), so the backend can group on the message.

Every procedure is logged by a middleware attached to `publicProcedure` as `trpc.<path>`, so a
route added to the router needs no logging code. Severity follows the fault: `INTERNAL_SERVER_ERROR` is logged at
`error` with the cause, and every other tRPC code at `warn` with its detail — bad input from a
client is not a system failure, and paging on it is the flood this module exists to prevent.
Errors that never reach a procedure (an unresolved path) are logged by the route handler's
`onError` under the flat `trpc.failed` message, because there `path` is unvalidated client input
and belongs in the fields rather than in the message.

### Adding a sink

1. Write the adapter in `apps/obs/src/adapters/`, implementing `EventSink`.
2. Point `apps/obs/src/runtime.ts` at it.

There is no config union and no factory, because no adapter takes an argument — a provider string
would carry no information the import does not. Dropping Sentry means deleting
`apps/obs/src/adapters/sentry.ts` and its dependency; `@sujstack/obs-core` never referenced it.

`@sujstack/obs-core/testing` ships `createMemorySink` for asserting what your own code logged. It is
a test double, not an adapter — unlike `createMemoryKv`, nothing would ever run it.

## Metrics

Metrics are for alerting; logs are for explaining. Every counter and every alert rule is declared in
`apps/metrics/src/catalog.ts`, and the monitoring backend only evaluates and displays them.

```ts
export const counters = defineCatalog({
  "trpc.requests": defineCounter<{ outcome: "ok" | "client_error" | "server_error" }>({
    description: "tRPC procedure calls that reached a procedure, by outcome",
  }),
})

metrics.increment("trpc.requests", { outcome: "ok" })
```

Rules are built from typed counters, never from metric-name strings, and compile to a standard
Prometheus rule file that Prometheus, Mimir, Grafana Cloud and Thanos all load:

```ts
{
  alert: "TrpcServerErrorRatio",
  severity: "page",
  for: "10m",
  expr: ratioAbove(select(requests, { outcome: "server_error" }), requests, { window: "5m", threshold: 0.05 }),
  summary: "More than 5% of tRPC calls are failing with a server error",
}
```

`rateAbove`, `ratioAbove` and `absent` cover the common shapes; anything else uses the `promql`
tag, whose interpolations must be counters or `select(...)`. `bun run metrics:rules` writes
`apps/metrics/rules.yaml`, which is committed; `bun run metrics:check` fails when it is stale.
Uploading it to the backend (`mimirtool rules load`, `cortextool`, or the Prometheus config) is
deliberately outside the code. Routing on `severity` belongs to Alertmanager or Grafana
notification policies.

In development increments print to the console. In production they are pushed over OTLP/HTTP when
`OTEL_EXPORTER_OTLP_ENDPOINT` is set (with `OTEL_EXPORTER_OTLP_HEADERS` for credentials), and
dropped when it is not. `@sujstack/metrics-core/testing` ships `createMemorySink`.

### Adding a counter or rule

1. Add a `defineCounter<Labels>(...)` entry to the catalog, and a rule to `rules` if it should alert.
2. Call `metrics.increment(...)` — the key and labels are type-checked against the catalog.
3. Run `bun run metrics:rules` and commit `rules.yaml`.

### UI components

`lib/ui/src/index.ts` re-exports each component file with `export *`, so everything a file
exports propagates automatically — but a **new file needs its own line** there. Components are
also reachable individually as `@sujstack/ui/components/button` without touching the barrel.

### Routes

Paths live in `apps/next/src/routes.ts`, not inline. The tRPC endpoint in particular appears in
two places that must agree — the route handler's `endpoint` and the client link's URL — so it is
a single const. `absoluteUrl()` there returns a relative URL in the browser and an absolute one
on the server, which has no origin of its own.

### Query defaults

TanStack Query defaults live in `apps/next/src/trpc/config.ts`. Edit `queryDefaults` to change
them app-wide, or pass `defaultOptions` to `<TRPCReactProvider>` to override one subtree. The
client is built once on mount, so changing the prop afterwards has no effect.

## Design decisions

**Secrets come from the environment; topology and behavior come from code.** `DATABASE_URL` is
the only environment variable, because it is a per-deployment secret. Which adapter backs a store,
the vector dimensionality and the distance metric are *not* deployment config — changing the
metric or dimensions silently invalidates every vector already stored, so they are code, in
`runtime.ts`. A flat `KV_PROVIDER=redis` string also cannot express that Redis needs a URL while
Pinecone needs an API key and index name; a discriminated union can. Credentials are read at the
composition root and passed in as data, so nothing below it touches `process.env`.

**Messages are free-form; there is no event catalog.** Grouping is the backend's job — Sentry
fingerprints on the stack and the message — so a hand-maintained list of keys in code would
duplicate it and add an edit to every new log line. Nothing is sampled either: sampling solves
ingest cost, which is a different problem, and it turns error counts into estimates. There is no
`minLevel` in the facade: verbosity is an adapter property, and the Sentry adapter is where a floor
belongs.

**One `write()` is one delivery.** `EventSink.write` returns `void`, must not throw, and must not
block; batching, retries and delivery are the adapter's business, and the model is eventual
consistency. A logging call must never fail the request it is logging about, so `createLog` isolates
each sink in a `try`/`catch`. Adapter authors on serverless should note that a bare `void fetch(…)`
can be killed when the response returns — that is an adapter concern, deliberately not in the port.

**`error()` requires its cause, and the cause stays raw.** The failure mode is
`log.error(message, { error: err.message })`, which flattens an `Error` into a string and destroys the
stack. Making the cause a required parameter gives the `Error` a home, and the facade passes it
through untouched so Sentry can parse the real stack and fingerprint on it — a pre-serialised object
would break both. The console adapter relies on the runtime printing `cause` chains natively.

**Metrics are separate from logs, and they do have a catalog.** A log message can be free-form
because nothing refers back to it. An alert rule does refer back to a metric, so a metric needs a
declared, stable key: renaming a counter must break the rule that watches it at compile time, not
leave the rule silently watching nothing.

**Alert rules are declared in code and evaluated by the backend.** Code is the source of truth, so
the rules live beside the counters they reference. Evaluation does not: an in-process evaluator
would lose its windows on every restart and see only one instance's traffic. The rules compile to
Prometheus rule YAML, which every Prometheus-compatible backend loads and Grafana displays, and
the generated file is committed and drift-checked the same way migrations are.

**Rules are built with typed builders, not written as YAML.** Hand-written PromQL names metrics
as strings, and those strings are not the names in code: OTLP ingestion rewrites
`trpc.requests` to `trpc_requests_total`. `promName` is the one place that translation lives. The
builders are deliberately thin — there is no PromQL AST — and the `promql` tag is the escape
hatch that keeps metric references typed while allowing any expression.

**Labels are a type parameter, not a runtime value list.** `defineCounter<{ outcome: "ok" | "error" }>`
gives the same compile-time checking at `increment` and in `select` as an `as const` array would,
without the ceremony, and it can reuse unions the domain already has. A label typed as plain
`string` is a compile error, so an unbounded label (a user id, a raw path) cannot be declared at
all — that is the cardinality guard. The cost is no runtime validation and no way to enumerate a
label's values; nothing needs either yet. This is also why `trpc.requests` has no `path` label:
the middleware only has `path` as a `string`, and the per-path breakdown lives in the logs.

**Counters are cumulative, one series per instance.** Prometheus and Mimir expect cumulative
temporality. Each process sets a random `service.instance.id`, which becomes the `instance` label,
so two instances' cumulative totals never collide in one series; rules aggregate with `sum(...)`.
On serverless this means one short-lived series per instance, and the periodic reader can lose the
last export interval when a function is frozen — an adapter concern, like the note on `write()`.

**Errors are masked at the tRPC boundary, not only at render.** `errorFormatter` in
`lib/trpc/src/init.ts` replaces an `INTERNAL_SERVER_ERROR`'s message and strips its stack, so
neither reaches the browser; the server keeps both in the log. Client faults keep their message,
which the caller needs in order to fix the request. Masking only in `error.tsx` would hide a
server fault from the user but not from the network tab.

**Vector `id` is a plain `string`, not a UUID.** TypeScript has no UUID type, and providers
disagree: Pinecone and Chroma accept arbitrary strings, pgvector takes whatever the primary key
is, and Qdrant accepts only unsigned ints or UUIDs. Constraining the shared interface to UUIDs
would make everyone pay Qdrant's tax and rule out natural composite keys like `doc-42#chunk-3`,
which let a match be traced straight back to its source document. A Qdrant adapter should hash
non-UUID ids at its own boundary.

**`VectorMatch.score` is always higher-is-better.** Cosine and dot product behave that way
already; Euclidean is a distance, so Euclidean adapters invert it. Otherwise every call site
would need to know which provider is behind the interface — exactly the leak the abstraction
exists to prevent.

**No tRPC transformer.** superjson mainly exists to stop Drizzle `Date` columns arriving at the
client as strings while the types still claim `Date`. Timestamp columns use `mode: "string"`
instead, so the types are honest end to end and there is nothing left to fix. Add one in
`lib/trpc/src/init.ts` if you later need `Map`, `Set` or `BigInt` over the wire.

**Biome, not ESLint + Prettier.** `eslint-config-next` bundles `typescript-eslint`, whose peer
range excludes TypeScript 7 — it drives the TS compiler API directly, and the Go port reshaped it.
Biome parses TypeScript with its own Rust parser and has no dependency on the `typescript`
package, so TS 7 and linting coexist. It replaces Prettier too.

## Conventions

**Schema.** Table definitions in `apps/db/src/schema.ts` are human-authored; the types are not.
`User` and `NewUser` come from Drizzle's `$inferSelect` / `$inferInsert`, so they cannot drift
from the definitions. `db:generate` turns definitions into SQL and `db:check` fails on drift.
The barrel re-exports the schema with `export *`, so a new table needs no barrel edit.

**Optional arguments are used intentionally and sparingly.**

- A **discriminated union** when the return shape depends on the argument, or when absence is
  ambiguous — `KvEntry<T>` rather than `T | null` (which breaks down as soon as `T` can itself be
  null), and `include` selecting between `query` overloads rather than `includeVectors?: boolean`
  plus an optional `vector?`.
- A **plain optional** for one independent knob with an obvious safe default — `ttlSeconds`,
  `filter`.
- **Required** when there is no safe default (`topK`, which drives cost and recall) or when a
  default would be dangerous — `clear(prefix)` takes a required prefix and there is no
  store-wide wipe anywhere in the interface.

`exactOptionalPropertyTypes` is on, so a surviving optional means "absent", never "present and
undefined".

**Comments say what non-obvious code does.** They do not argue for design decisions or explain
concepts an implementer already knows — that material belongs in this file.
