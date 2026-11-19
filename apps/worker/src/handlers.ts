import type { Jobs } from "@app/server/jobs/catalog"
import type { JobHandlers } from "@sujstack/jobs-core"

export const handlers: JobHandlers<Jobs> = {
  "demo.sleep": async ({ ms, fail }, { attempt }) => {
    await Bun.sleep(ms)
    if (fail) throw new Error(`Simulated failure on attempt ${attempt}`)
    return { sleptMs: ms, finishedAt: new Date().toISOString() }
  },
}
