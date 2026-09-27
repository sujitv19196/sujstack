import { createMetrics, type MetricSink } from "@sujstack/metrics-core"
import { createConsoleSink } from "./adapters/console"
import { createOtlpSink, parseOtlpHeaders } from "./adapters/otlp"
import { counters } from "./catalog"

// The composition root: the only module that names a concrete adapter.

const production = process.env.NODE_ENV === "production"
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

function sinks(): MetricSink[] {
  if (!production) return [createConsoleSink()]
  // Inert without an endpoint, so the app boots uncredentialed.
  if (endpoint === undefined) return []
  const headers = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS ?? "")
  const options = { endpoint, headers, serviceName: "sujstack", exportIntervalMillis: 15_000 }
  return [createOtlpSink(options, counters)]
}

export const metrics = createMetrics(counters, sinks())

export type AppMetrics = typeof metrics
