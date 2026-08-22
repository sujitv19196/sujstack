import { z } from "zod"
import { publicProcedure, router } from "../init"

export const healthRouter = router({
  /** Reports what the data layer is wired to, without connecting. */
  check: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.databaseConfigured) ctx.log.error("db.unconfigured", { path: "health.check" })

    const vector = await ctx.vectors.describe()

    return {
      db: ctx.databaseConfigured ? ("configured" as const) : ("not connected" as const),
      kv: ctx.providers.kv,
      vector: ctx.providers.vector,
      vectorIndex: {
        dimensions: vector.dimensions,
        metric: vector.metric,
        count: vector.count,
      },
    }
  }),

  /** Writes, reads back and deletes a key. */
  kvRoundTrip: publicProcedure
    .input(z.object({ value: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const key = `health:round-trip`
      await ctx.kv.set(key, input.value, 60)
      const entry = await ctx.kv.get<string>(key)
      await ctx.kv.delete(key)

      return entry.found
        ? { ok: true as const, value: entry.value }
        : { ok: false as const, reason: "value was not readable after write" }
    }),
})
