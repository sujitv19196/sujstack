import type { JobHandlers } from "@sujstack/jobs-core"
import type { Jobs } from "@sujstack/next/jobs"

export const handlers: JobHandlers<Jobs> = {
  "demo.sleep": async ({ ms, fail }, { attempt }) => {
    await Bun.sleep(ms)
    if (fail) throw new Error(`Simulated failure on attempt ${attempt}`)
    return { sleptMs: ms, finishedAt: new Date().toISOString() }
  },
}
