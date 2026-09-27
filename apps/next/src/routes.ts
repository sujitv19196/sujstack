// Paths must match the App Router directory layout under src/app.
export const routes = {
  home: "/",
  api: {
    trpc: "/api/trpc",
    webhooks: {
      demo: "/api/webhooks/demo",
    },
  },
} as const

function baseUrl(): string {
  // The browser has an origin already; the server does not.
  if (typeof window !== "undefined") return ""
  return `http://localhost:${process.env.PORT ?? 3000}`
}

/** Relative in the browser, absolute on the server. */
export function absoluteUrl(path: string): string {
  return `${baseUrl()}${path}`
}
