# Changelog

Every template release, newest first. *Upgrade notes* say what an app must do when it merges the
release, beyond resolving conflicts; a release without them merges with no manual steps. See
*Upgrading to a newer template release* in `AGENTS.md`.

## Unreleased

The repository is public, and CI runs on every pull request and push to `main`.

- Added `.github/workflows/ci.yml`: typecheck, tests, Biome, `db:check`, `metrics:check`,
  `infra:check` and the build, on every pull request and push to `main`.
- Added `SECURITY.md` and a Dependabot config for the workflow's actions.
- Clone URLs in `README.md` and `AGENTS.md` are HTTPS, so they work without a GitHub SSH key.
- Fixed the Vercel build command: it ran `bun run db:migrate` in `apps/next`, which has no such
  script, so every deployment failed with `Script not found "db:migrate"`. It now runs
  `bun run --filter @app/db db:migrate`.

### Upgrade notes

- Run `terraform -chdir=infra apply` to update the Vercel project's build command, then redeploy.

## 0.3.0

The template no longer ships a deploy workflow or an HCP Terraform backend, both of which named
the template author's accounts. `infra/` now runs from your machine with local state.

- Removed `.github/workflows/infra.yml`.
- Removed the `cloud` block from `infra/versions.tf`.
- `github_repo` and `neon_org_id` in `infra/variables.tf` have no default.

### Upgrade notes

An app that already deploys through HCP Terraform and the workflow should keep both: on the
conflict, keep the app's `cloud` block in `infra/versions.tf`, its `.github/workflows/infra.yml`
(a modify/delete conflict: keep it with `git add`) and its `github_repo` / `neon_org_id` defaults.

## 0.2.0

Server code moves out of the Next app into workspace packages, so the worker can run it too. A job
handler that needed the database, a router or a composition root used to have to import from
`apps/next`; now both apps import `@app/server`.

- `packages/db` (`@app/db`): the schema, the `Database` / `Transaction` types (`src/types.ts`),
  drizzle-kit's config and migrations, and the `db:*` scripts, which load `apps/next/.env.local`.
- `packages/server` (`@app/server`): everything that was in `apps/next/src/server` except the
  schema — composition roots, catalogs, tRPC, MCP, webhooks — plus `rules.yaml` and
  `scripts/rules.ts`.
- `packages/shared` (`@app/shared`): `config.ts` and `routes.ts`, which both the browser and the
  server import.
- `apps/next` keeps pages, components, the React tRPC bindings and route handlers that import
  `@app/server`. It no longer exports `./jobs` and `./metrics`; the worker imports
  `@app/server/jobs/catalog` and `@app/server/metrics/catalog`.
- Root `workspaces` include `packages/*`; `transpilePackages` lists the `@app/*` packages.
- Render redeploys the worker on any change under `packages/`.
- `CLAUDE.md`, `AGENTS.md`, `README.md`, `.env.example` and the skills point at the new paths.

### Upgrade notes

Merge the release, then move the app's own code the same way the template's moved (use `git mv`
so history follows):

1. `apps/next/src/server/db/schema.ts` → `packages/db/src/schema.ts`, and
   `apps/next/migrations/` → `packages/db/migrations/`. Import `Database` / `Transaction` from
   `@app/db/types` in anything outside `db/runtime.ts`.
2. Everything else in `apps/next/src/server/` → `packages/server/src/`, keeping its relative layout.
   Imports of the schema become `@app/db/schema`; of `config` or `routes`, `@app/shared/config` and
   `@app/shared/routes`.
3. Anything in `apps/next/src` (other than pages and components) that server code imports — date or
   money helpers, for example — → `packages/shared/src/`.
4. In `apps/next`, replace relative imports of `../server/...` with `@app/server/...`, and of
   `config` / `routes` with `@app/shared/...`.
5. Move the app's server dependencies (`drizzle-orm`, `zod`, `@trpc/server`, kit packages, SDKs the
   server calls) from `apps/next/package.json` to `packages/server/package.json` (and
   `drizzle-kit` to `packages/db`), then `bun install`.
6. In the worker, replace `@sujstack/next/jobs` and `@sujstack/next/metrics` with
   `@app/server/jobs/catalog` and `@app/server/metrics/catalog`, and the `@sujstack/next`
   dependency with `@app/server`.
7. `bun run typecheck && bun test && bun run check && bun run db:check && bun run metrics:check &&
   bun run build`.

## 0.1.0

The first versioned release of the template. Apps start from it by cloning with history, as
described in `AGENTS.md`, so later releases merge with `git merge template/vX.Y.Z`.

- Next 16 app on the kit's ports and adapters, pinned to kit `v0.4.1`.
- Postgres via Drizzle on Neon, a key/value store and a vector store behind ports.
- Logs to the console or Sentry, counters to the console or OTLP, alert rules in `rules.yaml`.
- tRPC with logging, counting and error masking; webhooks with verification; background jobs on a
  Render worker via pg-boss, off until `worker_enabled`.
- `/api/mcp` serves tRPC procedures that opt in with `.meta({ mcp: { description } })` as MCP tools.
- Terraform for Vercel, Neon and Render, planned on PR and applied on merge.
- `AGENTS.md`, `sujstack.json` and this changelog: how apps start from, and upgrade with, the
  template.
- Agent skills in `.claude/skills/` for common app tasks (add a job, a webhook provider, an MCP tool,
  a metric, an env var; remove the demo; upgrade the template).

### Upgrade notes

None: there is nothing to upgrade from.
