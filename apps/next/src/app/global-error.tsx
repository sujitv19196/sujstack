"use client"

import { useEffect } from "react"
import { GENERIC_ERROR_MESSAGE } from "../config"
import { log } from "../server/obs"
import "./globals.css"

// Replaces the root layout when it fires, so it renders its own document shell.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    log.error("app.unhandled", error, { boundary: "root", digest: error.digest ?? "" })
  }, [error])

  return (
    <html lang="en">
      <body className="antialiased">
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8">
          <p className="text-muted-foreground text-sm">{GENERIC_ERROR_MESSAGE}</p>
          <button type="button" onClick={reset} className="text-sm underline underline-offset-4">
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
