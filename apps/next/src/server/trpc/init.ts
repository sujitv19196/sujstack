import { createTrpc } from "@sujstack/trpc-core"
import { GENERIC_ERROR_MESSAGE } from "../../config"
import type { Context } from "./context"

const t = createTrpc<Context>({ genericErrorMessage: GENERIC_ERROR_MESSAGE })

export const { router, middleware, createCallerFactory } = t

// Every base procedure extends this one, so each call is logged and counted.
const baseProcedure = t.procedure.use(t.logged)

export const publicProcedure = baseProcedure
