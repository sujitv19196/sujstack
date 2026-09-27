import { defineNamespace, SchemaValidationError } from "@sujstack/db-core"
import { TRPCError } from "@trpc/server"
import { z } from "zod"
import { publicProcedure, router } from "../init"

const SAMPLE_DOCS = [
  "Drizzle is the relational interface to the Postgres database",
  "The key value store keeps short lived values with a TTL",
  "The vector store ranks documents by cosine similarity",
  "Logs record what happened and Sentry groups errors by stack",
  "Counters feed alert rules that page when error ratios climb",
  "Biome formats and lints the code instead of ESLint and Prettier",
  "Tailwind and shadcn components style the user interface",
  "tRPC procedures validate input with Zod before they run",
]

/** A toy embedding: hashed bag of words, L2-normalised. Stands in for a real embedding model. */
function embed(text: string, dimensions: number): number[] {
  const vector = new Array<number>(dimensions).fill(0)
  for (const word of text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []) {
    let hash = 0
    for (const char of word) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    vector[hash % dimensions] = (vector[hash % dimensions] ?? 0) + 1
  }
  const norm = Math.hypot(...vector) || 1
  return vector.map((value) => value / norm)
}

const profileSchema = z.object({
  name: z.string().min(1),
  visits: z.number().int().nonnegative(),
})

export const demoRouter = router({
  /** What the app is wired to. Unlike `health.check`, works without a database. */
  stack: publicProcedure.query(async ({ ctx }) => ({
    database: ctx.databaseConfigured ? ("configured" as const) : ("not configured" as const),
    kv: ctx.providers.kv,
    vector: ctx.providers.vector,
    vectorIndex: await ctx.vectors.describe(),
  })),

  /** Fails on request, to show how each kind of fault is logged, counted and masked. */
  fault: publicProcedure
    .input(z.object({ kind: z.enum(["none", "client", "server"]) }))
    .mutation(({ input }) => {
      if (input.kind === "client") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Simulated client fault: bad input" })
      }
      if (input.kind === "server") {
        throw new Error("Simulated server fault: connection to db-internal-7:5432 refused")
      }
      return { ok: true as const }
    }),

  /** Seeds the sample documents, then returns the nearest ones to `text`. */
  vectorSearch: publicProcedure
    .input(z.object({ text: z.string().trim().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const { dimensions } = await ctx.vectors.describe()
      await ctx.vectors.upsert(
        SAMPLE_DOCS.map((text, i) => ({
          id: `demo-${i}`,
          vector: embed(text, dimensions),
          metadata: { text },
        })),
      )
      const matches = await ctx.vectors.query({
        vector: embed(input.text, dimensions),
        topK: 3,
        include: "metadata",
      })
      return matches.map((match) => ({
        id: match.id,
        score: match.score,
        text: String(match.metadata.text),
      }))
    }),

  /** Writes through a schema-validated namespace. The input is deliberately looser than the schema. */
  namespaceWrite: publicProcedure
    .input(z.object({ name: z.string(), visits: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const profiles = defineNamespace(ctx.kv, "demo-profile", profileSchema)
      try {
        await profiles.set("current", input, 300)
      } catch (error) {
        if (!(error instanceof SchemaValidationError)) throw error
        return { ok: false as const, issues: error.issues.map((issue) => issue.message) }
      }
      const stored = await profiles.get("current")
      return stored.found
        ? { ok: true as const, stored: stored.value, keys: await profiles.list() }
        : { ok: false as const, issues: ["value was not readable after write"] }
    }),
})
