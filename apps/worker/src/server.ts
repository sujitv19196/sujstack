import express from "express"

/** `/health` answers 200 while `healthy` resolves true, and 503 otherwise. */
export function createServer({ healthy }: { healthy: () => Promise<boolean> }) {
  const app = express()
  app.disable("x-powered-by")
  app.get("/health", async (_request, response) => {
    const ok = await healthy()
    response.status(ok ? 200 : 503).json({ ok })
  })
  return app
}
