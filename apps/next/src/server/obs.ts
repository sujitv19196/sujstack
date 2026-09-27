import { createConsoleSink } from "@sujstack/obs-adapters/console"
import { createSentrySink } from "@sujstack/obs-adapters/sentry"
import { createLog } from "@sujstack/obs-core"

// The composition root: the only module that names a concrete adapter.

const production = process.env.NODE_ENV === "production"

export const log = createLog(production ? [createSentrySink()] : [createConsoleSink()])
