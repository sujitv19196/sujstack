---
name: remove-demo
description: Remove the sujstack demo (home page tour, demo router, demo webhook, demo.sleep job, demo Terraform secret) from an app. Use when starting a real app from the template or when asked to strip the demo or start clean.
---

Follow *Removing the demo* in `AGENTS.md`: every piece is listed there, in order. Do it in one
commit, and add `"demo"` to `removed` in `sujstack.json` in that same commit, so later template
upgrades know to keep the demo files deleted.

Where the demo occupies a slot the app will fill (the webhook `source` label, the `Jobs` catalog),
prefer replacing it with the app's first real entry over leaving it empty. If it must be empty, a
`Jobs` type is `Record<never, never>` and the webhook source is `never`.

Finish with `bun run check:fix`, then `bun run typecheck && bun test && bun run check && bun run build`,
plus `bun run metrics:check`, `bun run db:check` and `bun run infra:check`.
