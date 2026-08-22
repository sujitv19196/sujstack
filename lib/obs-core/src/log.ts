import type { EventRecord, EventSink, Fields, Level } from "./sink"

/** Declared intent for the monitoring backend. Never evaluated in this process. */
export interface EventAlert {
  readonly ratePerMinute: number
  readonly forMinutes: number
  /** `page` wakes a human now; `ticket` goes in a queue for business hours. */
  readonly severity: "page" | "ticket"
}

export interface EventDefinition {
  /** Static. The variable part goes in `fields`, never into this string. */
  readonly message: string
  readonly alert?: EventAlert
}

export type EventCatalog = Readonly<Record<string, EventDefinition>>

/** Catalog keys, plus every tRPC procedure path, which the middleware registers as it runs. */
export type EventKey<C extends EventCatalog> = (keyof C & string) | `trpc.${string}`

export interface Log<C extends EventCatalog> {
  debug(key: EventKey<C>, fields?: Fields): void
  info(key: EventKey<C>, fields?: Fields): void
  warn(key: EventKey<C>, fields?: Fields): void
  /** `cause` is required: an error record without the thing that failed is not worth writing. */
  error(key: EventKey<C>, cause: unknown, fields?: Fields): void
}

export function createLog<C extends EventCatalog>(events: C, sinks: readonly EventSink[]): Log<C> {
  const emit = (key: string, level: Level, fields: Fields, cause?: unknown) => {
    const record: EventRecord = {
      key,
      // A tRPC route has no catalog entry unless one was added to attach an alert.
      message: events[key]?.message ?? key,
      level,
      fields,
      ...(cause !== undefined && { cause }),
      time: Date.now(),
    }

    for (const sink of sinks) {
      try {
        sink.write(record)
      } catch {
        // A broken sink must not fail the request it is logging about, nor starve the sinks
        // after it in the list.
      }
    }
  }

  return {
    debug: (key, fields = {}) => emit(key, "debug", fields),
    info: (key, fields = {}) => emit(key, "info", fields),
    warn: (key, fields = {}) => emit(key, "warn", fields),
    error: (key, cause, fields = {}) => emit(key, "error", fields, cause),
  }
}
