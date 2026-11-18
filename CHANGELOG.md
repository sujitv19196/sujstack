# Changelog

Every template release, newest first. *Upgrade notes* say what an app must do when it merges the
release, beyond resolving conflicts; a release without them merges with no manual steps. See
*Upgrading to a newer template release* in `AGENTS.md`.

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
