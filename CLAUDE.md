# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install
bun run dev                 # Next app on :3000
bun run build               # production build; also the fastest full integration check
bun run typecheck           # tsc --noEmit in every workspace package
bun run check               # Biome lint + format (read-only)
bun run check:fix           # Biome, writing fixes — run this before finishing
bun test                    # every test
bun test lib/obs-core       # one package
bun test path/to/file.test.ts
bun test -t "regex"         # one test by name
bun run db:generate         # schema → SQL migration (no connection needed)
bun run db:check            # fails if migrations have drifted from the schema
bun run db:migrate | db:push | db:studio   # require DATABASE_URL
```

There is **no build step for library packages**. They are consumed as TypeScript source and compiled
by Next via `transpilePackages` in `apps/next/next.config.ts` — a new workspace package must be added
to that array or the app will fail to compile it.

## Architecture

Bun workspaces (`apps/*`, `lib/*`). The organising idea is **Ports and Adapters**, applied twice.

| Package | Role |
| --- | --- |
| `lib/db-core` | Port. `KeyValueStore`, `VectorStore`. Zero runtime dependencies. |
| `apps/db` | Adapters, Drizzle schema, composition root. |
| `lib/obs-core` | Port. `EventSink` + the `createLog` facade. Zero runtime dependencies. |
| `apps/obs` | Adapters (console, Sentry), the event catalog, composition root. |
| `lib/trpc` | Router, `Context`, React bindings. |
| `lib/ui` | Tailwind v4 theme + shadcn/ui. |
| `apps/next` | The application. |

The `-core` packages hold interfaces only, and the arrow is **enforced by `package.json`**: they do
not list the adapter package as a dependency, so code holding a port physically cannot reach a
provider. `apps/*` is where a composition root lives — the only module that names a concrete
provider, reads `process.env`, and owns the singletons (`apps/db/src/runtime.ts`,
`apps/obs/src/runtime.ts`).

Adding a provider means: write the adapter, add a member to the config union, add a `case` to the
factory, point the composition root at it. There is deliberately **no runtime provider registry and
no "unknown provider" error** — switches are exhaustive with no `default`, so a missing case is a
compile error. `apps/obs` has no config union or factory at all, because no sink takes an argument.

Drizzle is deliberately *not* wrapped in a port (it already abstracts the SQL dialect). `apps/db/src/client.ts`
uses a lazy `Proxy` so importing the module never opens a connection; the first *query* throws if
`DATABASE_URL` is unset.

`lib/trpc` depends on `@sujstack/db` and `@sujstack/obs` as **devDependencies only**, for types
(`Database`, `AppLog`). `verbatimModuleSyntax` erases `import type`, so neither runtime dependency
enters its graph. Preserve this — a runtime dependency there inverts the arrow.

### Observability

The unit is the **event key**. One entry in `apps/obs/src/events.ts` carries the message and the
alert threshold; `log.info(key, fields)` takes a key from that catalog, so a typo is a compile error.

```ts
log.debug|info|warn(key, fields?)
log.error(key, cause, fields?)   // cause is REQUIRED and comes BEFORE fields
```

Fields are `Record<string, unknown>` — the catalog closes the set of *keys*, not each payload shape.
`EventKey` also admits any `` `trpc.${string}` ``, so tRPC procedures register themselves per route
with no catalog edit; add an entry only to attach a threshold to one route.

Severity follows the fault, and this split is deliberate: `INTERNAL_SERVER_ERROR` logs at `error`
with the cause, every other tRPC code at `warn`. Logging bad client input at error level is the
flood the module exists to prevent. Errors that never reach a procedure are logged by `onError` in
the route handler under the flat `trpc.failed` key, because there `path` is unvalidated client input
and must stay in the fields — never in the key.

`error()` requires its cause and passes it through **raw**; Sentry needs the live `Error` to parse
the stack and fingerprint on it. Do not serialize it in the facade.

Nothing reads the `alert` field yet. Sentry is inert without a DSN, so the app boots uncredentialed.
`@sujstack/obs-core/testing` exports `createMemorySink` for asserting what code logged.

### Errors across the wire

`errorFormatter` in `lib/trpc/src/init.ts` replaces an `INTERNAL_SERVER_ERROR`'s message and strips
its stack, so neither reaches the browser while the server keeps both in the log. Client faults keep
their message, which the caller needs. `apps/next` also masks at render via `GENERIC_ERROR_MESSAGE`,
but that alone would hide a server fault from the user and not from the network tab.

## Conventions

- **Rationale lives in `README.md`, not in comments.** Comments say what non-obvious code *does*, in
  one terse line. Most functions have none. When you make a design decision, add a paragraph to the
  README's *Design decisions* section rather than arguing it in a code comment.
- **Biome, not ESLint/Prettier** (`eslint-config-next` bundles `typescript-eslint`, whose peer range
  excludes TS 7). Double quotes, **no semicolons**, 100 columns, 2-space indent.
- **Adapters are closure-based factory functions returning object literals, never classes.** Private
  state lives in closure variables. See `apps/db/src/adapters/kv/memory.ts`.
- **Contract suites live with the port** and are the executable spec of what it means
  (`@sujstack/db-core/testing`), so an adapter's test file is three lines. `obs-core` has none on
  purpose: `write(record): void` with no return, no throw and no readback has no semantics to assert.
- **Optional arguments are used sparingly.** A discriminated union when the return shape depends on
  the argument or absence is ambiguous (`KvEntry<T>` over `T | null`); a plain optional only for one
  independent knob with an obvious safe default; required when there is no safe default.
- `exactOptionalPropertyTypes` is on, so a surviving optional means "absent", never "present and
  undefined" — build records with `...(x !== undefined && { x })` rather than assigning `undefined`.
- **Secrets come from the environment; topology and behaviour come from code.** Adapter selection,
  vector dimensions and distance metric live in `runtime.ts`, not in env vars. Credentials are read
  at the composition root and passed down as data, so nothing below it touches `process.env`.
- Table definitions in `apps/db/src/schema.ts` and the catalog in `apps/obs/src/events.ts` are
  human-authored; their types are not (`$inferSelect`, `typeof events`), so they cannot drift.
- `bun test` does **not** typecheck. Type-level assertions need `@ts-expect-error` in a file that
  `bun run typecheck` sees.
- `apps/next/next-env.d.ts` is generated and flips between `.next/types` and `.next/dev/types`
  depending on whether `build` or `dev` ran last. Leave it out of diffs.

## Verifying

`bun run typecheck && bun test && bun run check` is the fast loop, but none of it exercises the app.
For anything touching tRPC, logging, or error handling, run `bun run dev` and drive it with `curl`:
a passing typecheck will not tell you that a client fault logged at the wrong severity, that an
unresolved path double-logged, or that an error message leaked across the wire.
