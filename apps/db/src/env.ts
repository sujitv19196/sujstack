import { z } from "zod"

// Optional so that importing this module never throws.
const envSchema = z.object({
  DATABASE_URL: z.url().optional(),
})

export const env = envSchema.parse(process.env)

export type Env = z.infer<typeof envSchema>
