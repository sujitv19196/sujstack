"use client"

import { useTRPC } from "@sujstack/trpc/react"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sujstack/ui"
import { useMutation } from "@tanstack/react-query"
import { GENERIC_ERROR_MESSAGE } from "../../config"

export function KvCard() {
  const trpc = useTRPC()
  const roundTrip = useMutation(trpc.health.kvRoundTrip.mutationOptions())
  const write = useMutation(trpc.demo.namespaceWrite.mutationOptions())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Key/value</CardTitle>
        <CardDescription>
          A raw round trip with a 60 second TTL, and a write through a namespace that validates
          every value against a schema. The procedure's input is looser than the schema, so the
          namespace is what rejects a bad value.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => roundTrip.mutate({ value: "hello from the browser" })}
            disabled={roundTrip.isPending}
          >
            Run round trip
          </Button>
          {roundTrip.data && (
            <span className="font-mono text-sm">
              {roundTrip.data.ok ? `✓ ${roundTrip.data.value}` : `✗ ${roundTrip.data.reason}`}
            </span>
          )}
          {roundTrip.isError && (
            <span className="text-destructive text-sm">{GENERIC_ERROR_MESSAGE}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => write.mutate({ name: "Ada", visits: 3 })}
            disabled={write.isPending}
          >
            Write valid profile
          </Button>
          <Button
            variant="outline"
            onClick={() => write.mutate({ name: "", visits: -1.5 })}
            disabled={write.isPending}
          >
            Write invalid profile
          </Button>
        </div>
        {write.data?.ok === true && (
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
            {`✓ demo-profile:current = ${JSON.stringify(write.data.stored)}\n  keys: ${write.data.keys.join(", ")}`}
          </pre>
        )}
        {write.data?.ok === false && (
          <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-destructive text-xs">
            {`✗ rejected by the schema:\n${write.data.issues.map((issue) => `  ${issue}`).join("\n")}`}
          </pre>
        )}
        {write.isError && <p className="text-destructive text-sm">{GENERIC_ERROR_MESSAGE}</p>}
      </CardContent>
    </Card>
  )
}
