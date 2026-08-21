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

## Layout

| Package | Role |
| --- | --- |
| `lib/db-core` — `@sujstack/db-core` | **Ports.** Interfaces only. No third-party runtime dependencies. |
| `apps/db` — `@sujstack/db` | **Adapters**, Drizzle schema, and the composition root. |
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
