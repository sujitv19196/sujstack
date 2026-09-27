import { counters, rules } from "@sujstack/metrics"
import { promName, renderRules } from "@sujstack/metrics-core"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sujstack/ui"
import { Row } from "./row"

export function RulesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert rules as code</CardTitle>
        <CardDescription>
          Counters and rules are declared in <code>apps/metrics/src/catalog.ts</code>. Rules
          reference typed counters and compile to the Prometheus rule file below, committed as{" "}
          <code>apps/metrics/rules.yaml</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col">
          {Object.values(counters).map((counter) => (
            <Row key={counter.name} label={counter.description} value={promName(counter)} />
          ))}
        </div>
        <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
          {renderRules("sujstack", rules)}
        </pre>
      </CardContent>
    </Card>
  )
}
