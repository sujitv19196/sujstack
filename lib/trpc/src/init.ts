import { initTRPC } from "@trpc/server"
import type { Context } from "./context"

// No transformer: every payload is plain JSON.
const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure
export const middleware = t.middleware
export const createCallerFactory = t.createCallerFactory
