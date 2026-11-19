"use client"

import type { AppRouter } from "@app/server/trpc/routers/_app"
import { createTRPCContext } from "@trpc/tanstack-react-query"

// useTRPC() returns option builders for TanStack Query's own hooks:
//   useQuery(trpc.health.check.queryOptions())
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>()
