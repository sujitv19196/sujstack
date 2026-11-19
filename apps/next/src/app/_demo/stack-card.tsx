"use client"

import { GENERIC_ERROR_MESSAGE } from "@app/shared/config"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { useTRPC } from "../../trpc/react"
import { Row } from "./row"

export function StackCard() {
  const trpc = useTRPC()
  const stack = useQuery(trpc.demo.stack.queryOptions())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data layer</CardTitle>
        <CardDescription>
          Procedures see only the port interfaces — never which adapter is behind them. Adapters are
          chosen in code, in each composition root.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {stack.isPending && <p className="text-muted-foreground text-sm">Checking…</p>}
        {stack.isError && <p className="text-destructive text-sm">{GENERIC_ERROR_MESSAGE}</p>}
        {stack.data && (
          <div className="flex flex-col">
            <Row label="Relational (Drizzle)" value={stack.data.database} />
            <Row label="Key/value adapter" value={stack.data.kv} />
            <Row label="Vector adapter" value={stack.data.vector} />
            <Row
              label="Vector index"
              value={`${stack.data.vectorIndex.dimensions}d · ${stack.data.vectorIndex.metric} · ${stack.data.vectorIndex.count} vectors`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
