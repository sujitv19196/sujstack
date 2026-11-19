"use client"

import { GENERIC_ERROR_MESSAGE } from "@app/shared/config"
import { skipToken, useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { useTRPC } from "../../trpc/react"
import { Row } from "./row"

export function VectorCard() {
  const trpc = useTRPC()
  const [draft, setDraft] = useState("which store keeps values")
  const [text, setText] = useState("")
  const search = useQuery(trpc.demo.vectorSearch.queryOptions(text ? { text } : skipToken))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vector search</CardTitle>
        <CardDescription>
          Seeds eight sample sentences and returns the three nearest. Embeddings are a toy hashed
          bag of words, so matches are by shared words; swap in a real model for meaning.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            setText(draft.trim())
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={200}
            className="h-9 flex-1 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <Button type="submit" disabled={search.isFetching}>
            Search
          </Button>
        </form>
        {search.isError && <p className="text-destructive text-sm">{GENERIC_ERROR_MESSAGE}</p>}
        {search.data && (
          <div className="flex flex-col">
            {search.data.map((match) => (
              <Row key={match.id} label={match.text} value={match.score.toFixed(3)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
