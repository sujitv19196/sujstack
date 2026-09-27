import { defineCatalog, defineCounter, type Rule, ratioAbove, select } from "@sujstack/metrics-core"

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
})

const requests = counters["trpc.requests"]

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
]
