import { db, isDatabaseConfigured } from "@sujstack/db"
import { kv, kvConfig, vectorConfig, vectors } from "@sujstack/db/runtime"
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
    }),
  })
}

export { handler as GET, handler as POST }
