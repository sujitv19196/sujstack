import { db, kv, postgres, providers, vectors } from "../db/runtime"
import { jobs } from "../jobs/runtime"
import { metrics } from "../metrics/runtime"
import { log } from "../obs"
import { demoWebhookSecret } from "../webhooks/runtime"
import type { Context } from "./context"
import { countCalls } from "./init"

/** The context for one request. Shared by the tRPC and MCP routes, so both see the same caller. */
export function createContext(request: Request): Context {
  return {
    db,
    kv,
    vectors,
    jobs,
    databaseConfigured: postgres.isConfigured,
    providers,
    headers: request.headers,
    demoWebhookSecret,
    log,
    metrics,
    onCall: countCalls(metrics),
  }
}
