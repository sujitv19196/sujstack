import type { EventCatalog } from "@sujstack/obs-core"

// Adding a key here is the only way to make an event loggable.
// tRPC procedures register themselves as `trpc.<path>`; add an entry only to attach an alert.
export const events = {
  "trpc.failed": {
    message: "tRPC procedure failed",
    alert: { ratePerMinute: 5, forMinutes: 10, severity: "page" },
  },

  "app.unhandled": {
    message: "An error boundary caught an error",
    alert: { ratePerMinute: 10, forMinutes: 15, severity: "ticket" },
  },

  "db.unconfigured": {
    message: "A query ran with no DATABASE_URL set",
    alert: { ratePerMinute: 1, forMinutes: 1, severity: "page" },
  },
} satisfies EventCatalog

export type AppEvents = typeof events
