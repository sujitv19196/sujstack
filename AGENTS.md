# AGENTS.md

How to start an app from the sujstack template, work in it, and upgrade it to a newer template
release. For how the codebase itself works, read `CLAUDE.md`, which applies to every agent.

The model: sujstack is a **versioned template**, and the shared ports and adapters live in a separate
**kit** repo mounted at `kit/`. An app is a clone of the template that keeps its git history, so a
template release is merged into the app with an ordinary `git merge`, and git's three-way merge
does the work. Do not use a GitHub fork (one per account, cannot go private) or a copy with fresh
history (no common ancestor, so every upgrade is a hand-applied diff).

- Template version: `version` in the root `package.json`. Releases are tags `vX.Y.Z`.
- What changed, and what an app must do about it: `CHANGELOG.md`, under each release's
  *Upgrade notes*.
- What this app removed from the template: `sujstack.json`.

## Skills

Step-by-step procedures for common tasks, in the Agent Skills format (`SKILL.md` with a `name` and
a `description`). Each is versioned with the code it describes: template skills change with template
releases, kit skills with the kit tag `kit/` is pinned to. Claude Code loads them on its own; other
agents should read the matching file before starting the task.

| Skill | For |
| --- | --- |
| `.claude/skills/remove-demo/` | stripping the demo when starting a real app |
| `.claude/skills/upgrade-template/` | merging a newer template release |
| `.claude/skills/add-job/` | a background job: catalog, policy, worker handler, enqueue |
| `.claude/skills/add-webhook-provider/` | receiving webhooks from a new provider |
| `.claude/skills/expose-mcp-tool/` | serving a tRPC procedure as an MCP tool |
| `.claude/skills/add-metric/` | a counter or alert rule, and `rules.yaml` |
| `.claude/skills/add-env-var/` | a new secret or URL, from composition root to Terraform |
| `kit/.claude/skills/write-adapter/` | a new provider for an existing port (kit change) |
| `kit/.claude/skills/release-kit/` | releasing the kit and bumping `kit/` in the app |

Template skills are template-owned: improve one in the template, not in an app. An app's own
skills go in `.claude/skills/` under names the template does not use.

## Starting a new app

Replace `<app>` and `<owner>` throughout.

1. Clone with history, without tags, and keep the template as a remote named `template`, its tags
   namespaced under `template/` so they never collide with the app's own tags:

   ```sh
   git clone --no-tags git@github.com:sujitv19196/sujstack.git <app>
   cd <app>
   git remote rename origin template
   git config remote.template.tagOpt --no-tags
   git config --add remote.template.fetch '+refs/tags/*:refs/tags/template/*'
   git fetch template
   ```

2. Start from the latest release, never from the template's `main`:

   ```sh
   git reset --hard "$(git tag -l 'template/v*' --sort=-v:refname | head -1)"
   git submodule update --init
   bun install
   ```

3. Create the app's own private repository and push to it:

   ```sh
   gh repo create <owner>/<app> --private --source . --remote origin --push
   ```

4. Point the infrastructure at the new project: in `infra/variables.tf`, `name`, `github_repo`,
   `neon_org_id` and `render_owner_id`. Then follow *Setting up a new deployment* in `README.md` for the accounts and tokens. Leave the
   `sujstack` names elsewhere in the code alone: renaming them gains nothing and conflicts on every
   upgrade that touches those lines.

5. Remove the demo (below) when building the app's first real feature, and record it in
   `sujstack.json`.

6. Run the full check before the first commit of app code:
   `bun run typecheck && bun test && bun run check && bun run build`.

## Removing the demo

The home page is a tour of the stack, and its pieces reach into the router, the webhooks, the
jobs, the metrics catalog and Terraform. Remove it in one commit, so it is easy to recognise in a
later merge, and add `"demo"` to `removed` in `sujstack.json` in the same commit.

1. **UI and router.** Delete `apps/next/src/app/_demo/`, replace `apps/next/src/app/page.tsx`, delete
   `packages/server/src/trpc/routers/demo.ts` and `demo.test.ts`, and remove the `demo` line and its import
   from `routers/_app.ts`.
2. **Demo webhook.** Delete `src/app/api/webhooks/demo/` and `packages/server/src/webhooks/demo.ts` and
   `demo.test.ts`. Reduce `packages/server/src/webhooks/runtime.ts` to `export const webhooks = {}` (add
   real providers there later). Remove `webhooks.demo` from `packages/shared/src/routes.ts`, `demoWebhookSecret`
   from `packages/server/src/trpc/context.ts`, `packages/server/src/trpc/runtime.ts` and the fixture in
   `routers/health.test.ts`. In `packages/server/src/metrics/catalog.ts`, replace `source: "demo"` with the
   app's first real source, or with `never` until there is one.
3. **Demo job.** Remove `demo.sleep` from `packages/server/src/jobs/catalog.ts` and `apps/worker/src/handlers.ts`,
   and delete `apps/worker/src/handlers.test.ts`. An empty `Jobs` is `Record<never, never>`, not
   `{}`, which Biome rejects.
4. **Infrastructure and env.** In `infra/vercel.tf`, delete the `random_password.demo_webhook`
   resource and the `DEMO_WEBHOOK_SECRET` entry; in `.env.example`, delete the *Demo webhook*
   section.
5. `bun run check:fix`, then the full check above, plus `bun run metrics:check`, `bun run db:check`
   and `bun run infra:check`.

## Working in an app

Files fall into four groups. Keeping to them is what makes upgrades merge cleanly.

| Group | Files | Rule |
| --- | --- | --- |
| **Kit** | `kit/` | Never edit as part of an app change. A fix there is a kit release: see *Kit* in `CLAUDE.md`. |
| **Template-owned** | the template's `.claude/skills/`, `biome.json`, `tsconfig.base.json`, `bunfig.toml`, `packages/server/scripts/`, `apps/next/src/trpc/`, `apps/next/src/app/api/{trpc,mcp}/`, `apps/worker/src/{index,server}.ts`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md` | Do not edit in an app. If one needs to change, the change belongs in the template: make it there, release it, and merge the release. |
| **Shared** | composition roots (`packages/server/src/**/runtime.ts`, `packages/server/src/obs.ts`), `packages/server/src/trpc/{init,context}.ts`, the catalogs, `next.config.ts`, the `package.json` files, `.env.example`, `infra/` | The template ships these and the app extends them. Add to them; avoid rewriting the template's lines. |
| **App-owned** | `packages/db/src/schema.ts`, `packages/db/migrations/`, `packages/server/src/trpc/routers/` (except `health.ts`), and anything the app adds to `packages/`; `apps/next/src/app/` pages, `apps/next/src/components/` | The template does not change these after the demo is removed. |

Two rules decide where a change goes:

- **Kit first.** Anything every app built on this template would want — a fix to a port or
  adapter, a new adapter — goes into the kit, and reaches every app as a submodule bump.
- **Template second.** A fix to template-owned glue (the tRPC plumbing, Terraform shape) goes into
  the template as a release, so every app can merge it. Fixing it only in one app means it will
  conflict on the next upgrade.

App-specific guidance for agents goes in `docs/app.md`, not in the template-owned docs, so it never
conflicts with an upgrade.

## Upgrading to a newer template release

Upgrade on a branch, and review `terraform -chdir=infra plan` before applying anything a release
changed in `infra/`.

1. See where the app is and what is available:

   ```sh
   git fetch template
   bun pm pkg get version                              # current template version
   git tag -l 'template/v*' --sort=v:refname           # releases
   ```

2. Read the *Upgrade notes* of every release after the current one, up to the target:
   `git show template/vX.Y.Z:CHANGELOG.md`. A minor release (`0.x`) can need manual steps.

3. Merge the target release:

   ```sh
   git switch -c upgrade/template-vX.Y.Z
   git merge template/vX.Y.Z
   git submodule update --init                         # the release may pin a newer kit
   bun install
   ```

4. Resolve conflicts:
   - A **modify/delete** conflict on a file the app deleted as part of a feature listed in
     `sujstack.json` `removed` (for `demo`: anything named in *Removing the demo*): keep it
     deleted, with `git rm`, and apply any equivalent change the release made to it to the app's
     own code if it still applies.
   - A **template-owned** file: take the template's version (`git checkout --theirs <file>`); if the
     app had edited it, those edits belong in the template.
   - A **shared** file: keep both sides — the template's change and the app's additions.
   - `bun.lock`: take either side, then re-run `bun install`.

5. Apply the manual steps from the upgrade notes, then run the full check:
   `bun run typecheck && bun test && bun run check && bun run build && bun run metrics:check && bun run db:check`
   (and `bun run infra:check` if `infra/` changed).

6. Commit the merge and, if `infra/` changed, review `terraform -chdir=infra plan` before applying.

Never merge `template/main`: only release tags have upgrade notes, and only they pin a kit release.
