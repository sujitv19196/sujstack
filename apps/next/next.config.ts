import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Workspace packages are consumed as TypeScript source, so Next compiles them.
  transpilePackages: [
    "@sujstack/db-adapters",
    "@sujstack/db-core",
    "@sujstack/jobs-adapters",
    "@sujstack/jobs-core",
    "@sujstack/metrics-adapters",
    "@sujstack/metrics-core",
    "@sujstack/obs-adapters",
    "@sujstack/obs-core",
    "@sujstack/trpc-core",
    "@sujstack/webhook-core",
  ],

  // Stops `next dev` writing AGENTS.md and CLAUDE.md into apps/next.
  agentRules: false,
}

export default nextConfig
