"use client"

import type { AppRouter } from "@app/server/trpc/routers/_app"
import { routes } from "@app/shared/routes"
import { type DefaultOptions, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createTRPCClient, httpBatchLink } from "@trpc/client"
import { type ReactNode, useState } from "react"
import { queryDefaults } from "./config"
import { TRPCProvider } from "./react"

export interface TRPCReactProviderProps {
  children: ReactNode
  /** Read once on mount; later changes do not rebuild the client. */
  defaultOptions?: DefaultOptions
}

export function TRPCReactProvider({
  children,
  defaultOptions = queryDefaults,
}: TRPCReactProviderProps) {
  // Per render tree, not module scope: a shared client would leak data across SSR requests.
  const [queryClient] = useState(() => new QueryClient({ defaultOptions }))
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      // Relative: only the browser fetches through this client.
      links: [httpBatchLink({ url: routes.api.trpc })],
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  )
}
