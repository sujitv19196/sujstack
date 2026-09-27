import { router } from "../init"
import { demoRouter } from "./demo"
import { healthRouter } from "./health"

export const appRouter = router({
  demo: demoRouter,
  health: healthRouter,
})

export type AppRouter = typeof appRouter
