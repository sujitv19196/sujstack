"use client"

import { createTRPCContext } from "@trpc/tanstack-react-query"
import type { AppRouter } from "../server/trpc/routers/_app"

// useTRPC() returns option builders for TanStack Query's own hooks:
//   useQuery(trpc.health.check.queryOptions())
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>()
