// Paths must match the App Router directory layout under src/app.
export const routes = {
  home: "/",
  api: {
    trpc: "/api/trpc",
    mcp: "/api/mcp",
    webhooks: {
      demo: "/api/webhooks/demo",
    },
  },
} as const

/** The origin a server-side request arrived on, from the headers Vercel's proxy and `next dev` set. */
export function requestOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  if (host === null) throw new Error("The request has no host header to build an origin from.")
  return `${headers.get("x-forwarded-proto") ?? "http"}://${host}`
}
