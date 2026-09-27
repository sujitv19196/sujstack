"use client"

import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"

function Bomb(): never {
  throw new Error("Simulated render fault")
}

export function BoundaryCard() {
  const [armed, setArmed] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Render errors</CardTitle>
        <CardDescription>
          A component that throws while rendering. <code>error.tsx</code> catches it, logs{" "}
          <code>app.unhandled</code> with the cause, and shows the generic message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setArmed(true)}>
          Throw in render
        </Button>
        {armed && <Bomb />}
      </CardContent>
    </Card>
  )
}
