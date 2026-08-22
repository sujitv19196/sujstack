import * as Sentry from "@sentry/nextjs"

// Runs for both the Node and Edge runtimes. Without a DSN the SDK stays inert, so the app boots
// with no credentials.
export function register() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Required for `Sentry.logger`, which is how the sink reports anything below `warn`.
    enableLogs: true,
  })
}

export const onRequestError = Sentry.captureRequestError
