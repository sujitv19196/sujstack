import type { JobPolicies } from "@sujstack/jobs-core"

/** Every background job: name → payload. Shared by the producer (this app) and apps/worker. */
export type Jobs = {
  "demo.sleep": { ms: number; fail: boolean }
}

export const policies: JobPolicies<Jobs> = {
  "demo.sleep": { retryLimit: 2, timeoutSeconds: 60 },
}

export type JobName = keyof Jobs
