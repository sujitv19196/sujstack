import { createMemoryJobs } from "@sujstack/jobs-adapters/memory"
import { createPgBossQueue } from "@sujstack/jobs-adapters/pg-boss"
import { sql } from "drizzle-orm"
import { postgres } from "../db/runtime"
import { type Jobs, policies } from "./catalog"

// The composition root for jobs: the only module that names a queue adapter.
// Without a database, jobs go to an in-process queue that nothing works.

export const jobs = postgres.isConfigured
  ? createPgBossQueue<Jobs>({ db: postgres.db, sql })
  : createMemoryJobs<Jobs>({ policies }).queue
