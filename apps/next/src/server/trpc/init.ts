import { createTrpc } from "@sujstack/trpc-core"
import type { Context } from "./context"

export const { router, publicProcedure, middleware, createCallerFactory } = createTrpc<Context>()
