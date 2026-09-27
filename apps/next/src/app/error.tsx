"use client"

import { useEffect } from "react"
import { Button } from "../components/ui/button"
import { GENERIC_ERROR_MESSAGE } from "../config"
import { log } from "../server/obs"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    log.error("app.unhandled", error, { boundary: "render", digest: error.digest ?? "" })
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8">
      <p className="text-muted-foreground text-sm">{GENERIC_ERROR_MESSAGE}</p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </main>
  )
}
