"use client"

import { GENERIC_ERROR_MESSAGE } from "@app/shared/config"
import { routes } from "@app/shared/routes"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { useTRPC } from "../../trpc/react"

type Delivery = "signed" | "forged" | "crashing"

const DELIVERIES: readonly { delivery: Delivery; label: string; level: string; outcome: string }[] =
  [
    { delivery: "signed", label: "Signed", level: "info", outcome: "accepted" },
    { delivery: "forged", label: "Forged signature", level: "warn", outcome: "rejected" },
    { delivery: "crashing", label: "Handler throws", level: "error + cause", outcome: "failed" },
  ]

interface Exchange {
  readonly status: number
  readonly received: string
}

export function WebhookCard() {
  const trpc = useTRPC()
  const [results, setResults] = useState<Partial<Record<Delivery, Exchange>>>({})
  const send = useMutation(
    trpc.demo.webhookSend.mutationOptions({
      onSuccess: ({ status, received }, { delivery }) =>
        setResults((prev) => ({ ...prev, [delivery]: { status, received } })),
    }),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          <code>POST {routes.api.webhooks.demo}</code> is built by the kit's{" "}
          <code>createWebhookHandler</code>: it verifies the raw body with the app's own verifier
          before anything is parsed, then runs the app's handler. The kit logs each delivery as{" "}
          <code>webhook.demo</code> and hands the result to the app's <code>onDelivery</code>, which
          counts it in <code>webhooks.received</code>. Here a tRPC procedure plays the external
          service, signing and POSTing each delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {DELIVERIES.map(({ delivery, label, level, outcome }) => {
          const exchange = results[delivery]
          return (
            <div key={delivery} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
              <div className="flex items-center justify-between gap-4">
                <Button
                  size="sm"
                  variant={delivery === "crashing" ? "destructive" : "outline"}
                  onClick={() => send.mutate({ delivery })}
                  disabled={send.isPending}
                >
                  {label}
                </Button>
                <span className="text-right font-mono text-muted-foreground text-xs">
                  log: {level} · metric: outcome="{outcome}"
                </span>
              </div>
              {exchange && (
                <span className="font-mono text-xs">
                  response: {exchange.status} {exchange.received}
                </span>
              )}
            </div>
          )
        })}
        {send.isError && <p className="text-destructive text-sm">{GENERIC_ERROR_MESSAGE}</p>}
      </CardContent>
    </Card>
  )
}
