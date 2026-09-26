import { initTRPC } from "@trpc/server"
import type { Context } from "./context"
import { GENERIC_API_ERROR_MESSAGE } from "./errors"

// No transformer: every payload is plain JSON.
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    // A client fault keeps its message: the caller needs it to fix the request. A server fault
    // is replaced wholesale, so neither the message nor the stack reaches the browser.
    if (error.code !== "INTERNAL_SERVER_ERROR") return shape
    const { stack: _stack, ...data } = shape.data
    return { ...shape, message: GENERIC_API_ERROR_MESSAGE, data }
  },
})

/**
 * Emits one `trpc.<path>` event per resolved call. Errors that never reach a procedure are logged
 * by the handler's `onError` under the flat `trpc.failed` message instead.
 */
const logged = t.middleware(async ({ ctx, path, type, next }) => {
  const startedAt = performance.now()
  const result = await next()
  const fields = { path, type, durationMs: Math.round(performance.now() - startedAt) }

  if (result.ok) ctx.log.info(`trpc.${path}`, fields)
  else if (result.error.code === "INTERNAL_SERVER_ERROR") {
    ctx.log.error(`trpc.${path}`, result.error, { ...fields, code: result.error.code })
  } else {
    // A client fault is not a system failure. Logging bad input at error level is the flood
    // this module exists to prevent, and the stack points at the validator, not at a bug.
    ctx.log.warn(`trpc.${path}`, {
      ...fields,
      code: result.error.code,
      detail: result.error.message,
    })
  }

  return result
})

export const router = t.router
export const publicProcedure = t.procedure.use(logged)
export const middleware = t.middleware
export const createCallerFactory = t.createCallerFactory
