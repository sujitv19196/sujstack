import { AboutCard } from "./_demo/about-card"
import { BoundaryCard } from "./_demo/boundary-card"
import { FaultsCard } from "./_demo/faults-card"
import { JobsCard } from "./_demo/jobs-card"
import { KvCard } from "./_demo/kv-card"
import { PostgresCard } from "./_demo/postgres-card"
import { RulesCard } from "./_demo/rules-card"
import { StackCard } from "./_demo/stack-card"
import { VectorCard } from "./_demo/vector-card"
import { WebhookCard } from "./_demo/webhook-card"

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12 sm:px-8">
      <div>
        <h1 className="font-semibold text-2xl tracking-tight">Sujstack</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Bun · Next 16 · React 19 · TypeScript 7 · Drizzle · tRPC · OpenTelemetry
        </p>
      </div>

      <AboutCard />
      <StackCard />
      <PostgresCard />
      <JobsCard />
      <KvCard />
      <VectorCard />
      <FaultsCard />
      <WebhookCard />
      <RulesCard />
      <BoundaryCard />
    </main>
  )
}
