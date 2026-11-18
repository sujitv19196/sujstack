import type { McpMeta } from "@sujstack/mcp-adapters/trpc"
import type { Metrics } from "@sujstack/metrics-core"
import { createTrpc, type TrpcCall } from "@sujstack/trpc-core"
import { GENERIC_ERROR_MESSAGE } from "../../config"
import type { counters } from "../metrics/catalog"
import type { Context } from "./context"

const t = createTrpc<Context, McpMeta>({ genericErrorMessage: GENERIC_ERROR_MESSAGE })

export const { router, middleware, createCallerFactory } = t

// Every base procedure extends this one, so each call is logged and counted.
const baseProcedure = t.procedure.use(t.logged)

export const publicProcedure = baseProcedure

/** The context's `onCall`: counts each call in `trpc.requests`. */
export function countCalls(metrics: Metrics<typeof counters>) {
  return (call: TrpcCall) => metrics.increment("trpc.requests", { outcome: call.outcome })
}
