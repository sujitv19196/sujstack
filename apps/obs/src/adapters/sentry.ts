import * as Sentry from "@sentry/nextjs"
import type { EventRecord, EventSink } from "@sujstack/obs-core"

/**
 * Requires `Sentry.init` in the host app, and `enableLogs` for anything below `warn`.
 * `warn` and `error` raise issues; `debug` and `info` go to the log stream only.
 */
export function createSentrySink(): EventSink {
  return {
    write(record: EventRecord): void {
      // `key` is the only tag: it is bounded by the catalog, and the fields are not.
      const tags = { key: record.key }
      const contexts = { fields: { ...record.fields } }

      if (record.level === "error") {
        // The raw cause, so Sentry parses the real stack and fingerprints on it.
        Sentry.captureException(record.cause, { tags, contexts })
        return
      }

      if (record.level === "warn") {
        Sentry.captureMessage(record.message, { level: "warning", tags, contexts })
        return
      }

      Sentry.logger[record.level](record.message, { key: record.key, ...record.fields })
    },
  }
}
