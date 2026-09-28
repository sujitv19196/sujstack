import {
  defineCatalog,
  defineCounter,
  type Rule,
  rateAbove,
  ratioAbove,
  select,
} from "@sujstack/metrics-core"
import type { JobName } from "../jobs/catalog"

export const counters = defineCatalog({
  "trpc.requests": defineCounter<{ outcome: "ok" | "client_error" | "server_error" }>({
    description: "tRPC procedure calls that reached a procedure, by outcome",
  }),
  "webhooks.received": defineCounter<{
    source: "demo"
    outcome: "accepted" | "rejected" | "failed"
  }>({
    description: "Webhook deliveries, by source and outcome",
  }),
  "jobs.processed": defineCounter<{ job: JobName; outcome: "completed" | "retrying" | "failed" }>({
    description: "Background job attempts, by job and outcome",
  }),
})

const requests = counters["trpc.requests"]
const jobAttempts = counters["jobs.processed"]

export const rules: readonly Rule[] = [
  {
    alert: "TrpcServerErrorRatio",
    severity: "page",
    for: "10m",
    expr: ratioAbove(select(requests, { outcome: "server_error" }), requests, {
      window: "5m",
      threshold: 0.05,
    }),
    summary: "More than 5% of tRPC calls are failing with a server error",
  },
  {
    alert: "JobsFailing",
    severity: "ticket",
    for: "0m",
    expr: rateAbove(select(jobAttempts, { outcome: "failed" }), { window: "15m", threshold: 0 }),
    summary: "A background job has exhausted its retries",
  },
]
