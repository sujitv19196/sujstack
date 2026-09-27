import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"

export function AboutCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What is this</CardTitle>
        <CardDescription>
          A full-stack template built on Ports and Adapters. Storage, logging and metrics sit behind
          hand-written interfaces, so each provider is swappable without touching a call site.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>
          Nothing is connected out of the box: the app boots, typechecks, tests and runs with no
          database and no credentials. The cards below exercise the real code paths, running against
          the in-memory adapters.
        </p>
        <p>
          The ports and adapters live in <code>kit/</code>, a separately versioned package pinned to
          a release. The app owns only the composition roots, the metrics catalog, the routers and
          this UI.
        </p>
        <p className="text-muted-foreground">
          To start clean, delete <code>apps/next/src/app/_demo/</code>, then <code>demo.ts</code>{" "}
          and <code>demo.test.ts</code> in <code>apps/next/src/server/trpc/routers/</code>, and the
          router's line in <code>_app.ts</code>.
        </p>
      </CardContent>
    </Card>
  )
}
