import { createLog } from "@sujstack/obs-core"
import { createConsoleSink } from "./adapters/console"
import { createSentrySink } from "./adapters/sentry"

// The composition root: the only module that names a concrete adapter.

const production = process.env.NODE_ENV === "production"

export const log = createLog(production ? [createSentrySink()] : [createConsoleSink()])

export type AppLog = typeof log
