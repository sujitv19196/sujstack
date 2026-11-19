import { users } from "@app/db/schema"
import { requestOrigin, routes } from "@app/shared/routes"
import { defineNamespace, SchemaValidationError } from "@sujstack/db-core"
import { TRPCError } from "@trpc/server"
import { eq, sql, TransactionRollbackError } from "drizzle-orm"
import { z } from "zod"
import { signDemo } from "../../webhooks/demo"
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
  stack: publicProcedure
    .meta({
      mcp: {
        description:
          "Reports which providers the app is wired to (database, key-value store, vector store) " +
          "and the vector index's dimensions and metric. Takes no input and needs no database.",
      },
    })
    .query(async ({ ctx }) => ({
      database: ctx.databaseConfigured ? ("configured" as const) : ("not configured" as const),
      kv: ctx.providers.kv,
      vector: ctx.providers.vector,
      vectorIndex: await ctx.vectors.describe(),
    })),

  /** Inserts a row inside a transaction, commits or rolls it back, then checks what survived. */
  transaction: publicProcedure
    .input(z.object({ outcome: z.enum(["commit", "rollback"]) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.databaseConfigured) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "DATABASE_URL is not set" })
      }

      const email = `demo-${crypto.randomUUID()}@example.com`
      const started = performance.now()
      let rowsInside = 0
      try {
        await ctx.db.transaction(async (tx) => {
          await tx.insert(users).values({ email, name: "Transaction demo" })
          const inside = await tx.select({ id: users.id }).from(users).where(eq(users.email, email))
          rowsInside = inside.length
          if (input.outcome === "rollback") tx.rollback()
        })
      } catch (error) {
        if (!(error instanceof TransactionRollbackError)) throw error
      }
      const ms = Math.round(performance.now() - started)

      // Deleting the committed row doubles as the check for whether it persisted.
      const persisted = await ctx.db
        .delete(users)
        .where(eq(users.email, email))
        .returning({ id: users.id })
      const [server] = await ctx.db.execute<{ version: string; neon_timeline: string | null }>(
        sql`select version() as version, current_setting('neon.timeline_id', true) as neon_timeline`,
      )

      return {
        outcome: input.outcome,
        visibleInside: rowsInside === 1,
        persisted: persisted.length === 1,
        ms,
        server: server?.version.split(" ").slice(0, 2).join(" ") ?? "unknown",
        neonTimeline: server?.neon_timeline || null,
      }
    }),

  /** Enqueues a sleep for apps/worker, in a transaction. `fail` makes every attempt throw. */
  jobEnqueue: publicProcedure
    .input(z.object({ fail: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.databaseConfigured) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "DATABASE_URL is not set" })
      }
      const id = await ctx.db.transaction((tx) =>
        ctx.jobs.enqueue("demo.sleep", { ms: 2_000, fail: input.fail }, { tx }),
      )
      return { id }
    }),

  jobStatus: publicProcedure
    .meta({
      mcp: {
        description:
          "Looks up a demo.sleep background job by the id returned when it was enqueued, " +
          "and returns its state, attempt count and output.",
      },
    })
    .input(z.object({ id: z.uuid() }))
    .query(({ ctx, input }) => ctx.jobs.status("demo.sleep", input.id)),

  /** Fails on request, to show how each kind of fault is logged, counted and masked. */
  fault: publicProcedure
    .meta({
      mcp: {
        description:
          "Fails on request, to demonstrate error handling: 'client' returns a client error with " +
          "its message, 'server' a masked server error, 'none' succeeds.",
      },
    })
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
    .meta({
      mcp: {
        description:
          "Searches a small built-in set of documents about this stack's architecture and returns " +
          "the three most similar to the given text, with similarity scores.",
      },
    })
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

  /** Acts as an external service: signs a delivery and POSTs it to the demo webhook. */
  webhookSend: publicProcedure
    .input(z.object({ delivery: z.enum(["signed", "forged", "crashing"]) }))
    .mutation(async ({ ctx, input }) => {
      const body = JSON.stringify({
        id: `evt_${crypto.randomUUID()}`,
        type: input.delivery === "crashing" ? "demo.crash" : "demo.ping",
        sentAt: new Date().toISOString(),
      })
      const secret = input.delivery === "forged" ? "not-the-secret" : ctx.demoWebhookSecret
      const url = new URL(routes.api.webhooks.demo, requestOrigin(ctx.headers))
      const response = await fetch(url, {
        method: "POST",
        headers:
          secret === undefined ? { "content-type": "application/json" } : signDemo(body, secret),
        body,
      })
      return { status: response.status, sent: body, received: await response.text() }
    }),
})
