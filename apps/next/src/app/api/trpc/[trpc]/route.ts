import { db, isDatabaseConfigured } from "@sujstack/db"
import { kv, kvConfig, vectorConfig, vectors } from "@sujstack/db/runtime"
import { log } from "@sujstack/obs/runtime"
import { appRouter, type Context } from "@sujstack/trpc/server"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { routes } from "../../../../routes"

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: routes.api.trpc,
    req: request,
    router: appRouter,
    createContext: ({ req }): Context => ({
      db,
      kv,
      vectors,
      databaseConfigured: isDatabaseConfigured(),
      providers: { kv: kvConfig.provider, vector: vectorConfig.provider },
      headers: req.headers,
      log,
    }),
    onError: ({ error, path, type }) => {
      // Anything that reached a procedure was already logged under `trpc.<path>` by the
      // middleware. What is left never resolved, so `path` is unvalidated client input and
      // belongs in the fields rather than in the message.
      if (error.code !== "NOT_FOUND") return
      // A scanner hitting a route that does not exist is a client fault, not a system failure.
      log.warn("trpc.failed", { path: path ?? "<unresolved>", type, code: error.code })
    },
  })
}

export { handler as GET, handler as POST }
