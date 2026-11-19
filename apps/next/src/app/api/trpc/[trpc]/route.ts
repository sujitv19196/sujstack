import { log } from "@app/server/obs"
import { appRouter } from "@app/server/trpc/routers/_app"
import { createContext } from "@app/server/trpc/runtime"
import { routes } from "@app/shared/routes"
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: routes.api.trpc,
    req: request,
    router: appRouter,
    createContext: ({ req }) => createContext(req),
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
