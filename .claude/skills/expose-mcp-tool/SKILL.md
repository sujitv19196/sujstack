---
name: expose-mcp-tool
description: Expose a tRPC procedure to LLM clients as an MCP tool at /api/mcp in a sujstack app. Use when an agent or MCP client should be able to call an app operation.
---

Add `.meta({ mcp: { description } })` to the procedure, before `.input()`. See *MCP tools* in
`README.md`.

- The description is what the model reads to decide when to call the tool. Say what it does, what
  it returns, and when to use it, in one or two sentences; mention side effects for a mutation.
- The tool is named from the path, `.` → `_`: `notes.search` → `notes_search`. Names must be unique
  and match `^[a-zA-Z0-9_-]{1,64}$`; the handler throws at startup otherwise.
- The procedure needs at most one `.input()`, and it must be a `z.object`. Describe fields with
  `.describe()` where the name is not enough; it reaches the tool's JSON Schema.
- Auth is the procedure's own middleware: a tool built on a protected procedure is protected over
  MCP too. Do not add MCP-specific checks.

Check it with `bun run dev`, then `claude mcp add --transport http <app> http://localhost:3000/api/mcp`,
or POST `tools/list` to `/api/mcp` with `accept: application/json, text/event-stream`.
