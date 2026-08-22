"use client"

import { useTRPC } from "@sujstack/trpc/react"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sujstack/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { GENERIC_ERROR_MESSAGE } from "../config"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 last:border-b-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  )
}

export default function Home() {
  const trpc = useTRPC()
  const health = useQuery(trpc.health.check.queryOptions())
  const roundTrip = useMutation(trpc.health.kvRoundTrip.mutationOptions())

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Sujstack</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Bun · Next 16 · React 19 · TypeScript 7 · Drizzle · tRPC
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data layer</CardTitle>
          <CardDescription>
            Served over tRPC. Procedures see only the port interfaces — never which adapter is
            behind them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {health.isPending && <p className="text-muted-foreground text-sm">Checking…</p>}
          {health.isError && <p className="text-destructive text-sm">{GENERIC_ERROR_MESSAGE}</p>}
          {health.data && (
            <div className="flex flex-col">
              <Row label="Relational (Drizzle)" value={health.data.db} />
              <Row label="Key/value adapter" value={health.data.kv} />
              <Row label="Vector adapter" value={health.data.vector} />
              <Row
                label="Vector index"
                value={`${health.data.vectorIndex.dimensions}d · ${health.data.vectorIndex.metric} · ${health.data.vectorIndex.count} vectors`}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key/value round trip</CardTitle>
          <CardDescription>
            Writes, reads back and deletes a key with a 60 second TTL, through whichever adapter the
            composition root selected.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button
            onClick={() => roundTrip.mutate({ value: "hello from the browser" })}
            disabled={roundTrip.isPending}
          >
            {roundTrip.isPending ? "Running…" : "Run round trip"}
          </Button>
          {roundTrip.data && (
            <span className="font-mono text-sm">
              {roundTrip.data.ok ? `✓ ${roundTrip.data.value}` : `✗ ${roundTrip.data.reason}`}
            </span>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
