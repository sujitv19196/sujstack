"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { GENERIC_ERROR_MESSAGE } from "../../config"
import { useTRPC } from "../../trpc/react"
import { Row } from "./row"

export function PostgresCard() {
  const trpc = useTRPC()
  const stack = useQuery(trpc.demo.stack.queryOptions())
  const transaction = useMutation(trpc.demo.transaction.mutationOptions())
  const configured = stack.data?.database === "configured"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Postgres transactions</CardTitle>
        <CardDescription>
          Inserts a row inside a real transaction, then commits or rolls it back and checks what
          survived. Runs on any Postgres; on Neon, the row below names the branch that answered.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {stack.data && !configured && (
          <p className="text-muted-foreground text-sm">
            Set <code className="font-mono">DATABASE_URL</code> in{" "}
            <code className="font-mono">apps/next/.env.local</code> and run{" "}
            <code className="font-mono">bun run db:migrate</code> to enable this card.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => transaction.mutate({ outcome: "commit" })}
            disabled={!configured || transaction.isPending}
          >
            Commit
          </Button>
          <Button
            variant="outline"
            onClick={() => transaction.mutate({ outcome: "rollback" })}
            disabled={!configured || transaction.isPending}
          >
            Roll back
          </Button>
        </div>

        {transaction.data && (
          <div className="flex flex-col">
            <Row label="Outcome" value={transaction.data.outcome} />
            <Row
              label="Row visible inside the transaction"
              value={transaction.data.visibleInside ? "✓ yes" : "✗ no"}
            />
            <Row label="Row persisted after it" value={transaction.data.persisted ? "yes" : "no"} />
            <Row label="Transaction time" value={`${transaction.data.ms} ms`} />
            <Row label="Server" value={transaction.data.server} />
            <Row label="Neon branch timeline" value={transaction.data.neonTimeline ?? "not Neon"} />
          </div>
        )}
        {transaction.isError && (
          <p className="text-destructive text-sm">
            {transaction.error.data?.code === "PRECONDITION_FAILED"
              ? transaction.error.message
              : GENERIC_ERROR_MESSAGE}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
