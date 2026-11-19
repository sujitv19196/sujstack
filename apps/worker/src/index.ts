import { type Jobs, policies } from "@app/server/jobs/catalog"
import { counters } from "@app/server/metrics/catalog"
import { createPgBossWorker } from "@sujstack/jobs-adapters/pg-boss"
import { loggedHandlers } from "@sujstack/jobs-core"
import { createConsoleSink } from "@sujstack/metrics-adapters/console"
import { createOtlpSink, parseOtlpHeaders } from "@sujstack/metrics-adapters/otlp"
import { createMetrics, type MetricSink } from "@sujstack/metrics-core"
import { createConsoleSink as createConsoleLogSink } from "@sujstack/obs-adapters/console"
import { createLog } from "@sujstack/obs-core"
import { handlers } from "./handlers"
import { createServer } from "./server"

// The composition root: the only module that names an adapter or reads process.env.

const production = process.env.NODE_ENV === "production"
// pg-boss holds sessions and runs its own transactions, so it needs a direct connection.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (url === undefined) throw new Error("DATABASE_URL is not set, so there is no queue to work.")

function metricSinks(): MetricSink[] {
  if (!production) return [createConsoleSink()]
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (endpoint === undefined) return []
  const headers = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "")
  const options = {
    endpoint,
    headers,
    serviceName: "sujstack-worker",
    exportIntervalMillis: 15_000,
  }
  return [createOtlpSink(options, counters)]
}

const log = createLog([createConsoleLogSink()])
const metrics = createMetrics(counters, metricSinks())

const worker = createPgBossWorker<Jobs>({
  url,
  policies,
  onError: (cause) => log.error("jobs.worker", cause),
})

await worker.start(
  loggedHandlers<Jobs>(handlers, {
    log,
    onRun: ({ name, outcome }) => metrics.increment("jobs.processed", { job: name, outcome }),
  }),
)

const port = Number(process.env.PORT ?? 3001)
const server = createServer({ healthy: worker.healthy }).listen(port, () => {
  log.info("worker.started", { port, jobs: Object.keys(policies).length })
})

process.once("SIGTERM", async () => {
  log.info("worker.stopping")
  server.close()
  await worker.stop()
  process.exit(0)
})
