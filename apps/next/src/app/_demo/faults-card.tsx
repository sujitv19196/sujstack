"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { useTRPC } from "../../trpc/react"

type Kind = "none" | "client" | "server"

const KINDS: readonly { kind: Kind; label: string; level: string; outcome: string }[] = [
  { kind: "none", label: "Succeed", level: "info", outcome: "ok" },
  { kind: "client", label: "Client fault", level: "warn", outcome: "client_error" },
  { kind: "server", label: "Server fault", level: "error + cause", outcome: "server_error" },
]

interface Wire {
  readonly status: string
  readonly message: string
}

export function FaultsCard() {
  const trpc = useTRPC()
  const [results, setResults] = useState<Partial<Record<Kind, Wire>>>({})
  const fault = useMutation(
    trpc.demo.fault.mutationOptions({
      onSuccess: (_data, { kind }) =>
        setResults((prev) => ({ ...prev, [kind]: { status: "200", message: "ok" } })),
      onError: (error, { kind }) =>
        setResults((prev) => ({
          ...prev,
          [kind]: { status: String(error.data?.httpStatus ?? "?"), message: error.message },
        })),
    }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faults, logs and metrics</CardTitle>
        <CardDescription>
          Every procedure call is logged as <code>trpc.&lt;path&gt;</code> and counted in{" "}
          <code>trpc.requests</code>. Severity follows the fault. A server fault's message never
          crosses the wire — the real one is only in the server log. Watch the terminal running{" "}
          <code>bun run dev</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {KINDS.map(({ kind, label, level, outcome }) => {
          const wire = results[kind]
          return (
            <div key={kind} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
              <div className="flex items-center justify-between gap-4">
                <Button
                  size="sm"
                  variant={kind === "server" ? "destructive" : "outline"}
                  onClick={() => fault.mutate({ kind })}
                  disabled={fault.isPending}
                >
                  {label}
                </Button>
                <span className="text-right font-mono text-muted-foreground text-xs">
                  log: {level} · metric: outcome="{outcome}"
                </span>
              </div>
              {wire && (
                <span className="font-mono text-xs">
                  wire: {wire.status} “{wire.message}”
                </span>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
