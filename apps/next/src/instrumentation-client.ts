import * as Sentry from "@sentry/nextjs"

// Inert without a DSN, so the browser bundle costs nothing until one is set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enableLogs: true,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
