import { defineCatalog, type Rule, ratioAbove, select } from "@sujstack/metrics-core"
import { trpcCounterDefs } from "@sujstack/trpc-core"

export const counters = defineCatalog({
  ...trpcCounterDefs,
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
