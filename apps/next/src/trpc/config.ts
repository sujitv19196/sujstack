import type { DefaultOptions } from "@tanstack/react-query"

// TanStack Query defaults for the whole app. Override per tree by passing
// `defaultOptions` to <TRPCReactProvider>.
export const queryDefaults: DefaultOptions = {
  queries: {
    staleTime: 30_000,
  },
}
