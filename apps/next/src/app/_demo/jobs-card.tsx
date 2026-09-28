"use client"

import { skipToken, useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { GENERIC_ERROR_MESSAGE } from "../../config"
import { useTRPC } from "../../trpc/react"
import { Row } from "./row"

export function JobsCard() {
  const trpc = useTRPC()
  const stack = useQuery(trpc.demo.stack.queryOptions())
  const enqueue = useMutation(trpc.demo.jobEnqueue.mutationOptions())
  const id = enqueue.data?.id
  const status = useQuery(
    trpc.demo.jobStatus.queryOptions(id === undefined ? skipToken : { id }, {
      refetchInterval: (query) => {
        const state = query.state.data?.found ? query.state.data.state : undefined
        return state === "completed" || state === "failed" ? false : 500
      },
    }),
  )
  const configured = stack.data?.database === "configured"
  const job = status.data

  return (
    <Card>
      <CardHeader>
        <CardTitle>Background jobs</CardTitle>
        <CardDescription>
          This Vercel function writes a two-second job into a pg-boss table on Neon, inside the same
          transaction as any other write, so the job exists only if that commits. A long-running
          worker (apps/worker, a Bun + Express process on Railway, provisioned by infra/) polls that
          table, runs the job and stores its output; this card polls the job's row until it settles.
          A failing job is retried twice, then marked failed.
        </CardDescription>
        <CardDescription>
          The worker runs against production only, so on a preview deployment jobs stay queued.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {stack.data && !configured && (
          <p className="text-muted-foreground text-sm">
            Set <code className="font-mono">DATABASE_URL</code> and run{" "}
            <code className="font-mono">bun run worker</code> to enable this card.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => enqueue.mutate({ fail: false })}
            disabled={!configured || enqueue.isPending}
          >
            Run
          </Button>
          <Button
            variant="outline"
            onClick={() => enqueue.mutate({ fail: true })}
            disabled={!configured || enqueue.isPending}
          >
            Run and fail
          </Button>
        </div>

        {id !== undefined && (
          <div className="flex flex-col">
            <Row label="Job" value={id.slice(0, 8)} />
            {job?.found === false && <Row label="State" value="not found" />}
            {job?.found && (
              <>
                <Row label="State" value={job.state} />
                <Row label="Attempts" value={job.attempts} />
                {job.state === "completed" && (
                  <Row label="Output" value={JSON.stringify(job.output)} />
                )}
                {job.state === "failed" && <Row label="Error" value={job.error} />}
              </>
            )}
          </div>
        )}
        {(enqueue.isError || status.isError) && (
          <p className="text-destructive text-sm">
            {enqueue.error?.data?.code === "PRECONDITION_FAILED"
              ? enqueue.error.message
              : GENERIC_ERROR_MESSAGE}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
