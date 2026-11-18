---
name: add-metric
description: Add a counter or an alert rule to a sujstack app's metrics catalog and regenerate rules.yaml. Use when something should be counted, graphed or alerted on.
---

Follow *Metrics* and *Adding a counter or rule* in `README.md`. In short:

1. Add `defineCounter<Labels>({ description })` to `counters` in
   `apps/next/src/server/metrics/catalog.ts`. Every label is a union of literals: a label typed as
   `string` is a compile error, which is the cardinality guard. Never label by user, id or path.
2. Count with `metrics.increment(name, labels)`; both are type-checked against the catalog.
3. For an alert, add a rule to `rules` built from the counter object (`ratioAbove`, `rateAbove`,
   `select`), never from a name string.
4. `bun run metrics:rules` and commit `apps/next/rules.yaml`; `bun run metrics:check` fails if it drifts.

Logs are different: there is no log catalog. Use `log.info("area.event", fields)` with a static
message and the variable parts in `fields`.
