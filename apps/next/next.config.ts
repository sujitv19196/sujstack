import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Workspace packages are consumed as TypeScript source, so Next compiles them.
  transpilePackages: [
    "@sujstack/db",
    "@sujstack/db-core",
    "@sujstack/metrics",
    "@sujstack/metrics-core",
    "@sujstack/obs",
    "@sujstack/obs-core",
    "@sujstack/trpc",
    "@sujstack/ui",
  ],

  // Stops `next dev` writing AGENTS.md and CLAUDE.md into apps/next.
  agentRules: false,
}

export default nextConfig
