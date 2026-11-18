import { createMcpHandler } from "@sujstack/mcp-adapters/trpc"
import { z } from "zod"
import { GENERIC_ERROR_MESSAGE } from "../../config"
import { appRouter } from "../trpc/routers/_app"
import { createContext } from "../trpc/runtime"

// The composition root for MCP: serves every procedure whose meta sets `mcp` as a tool.

export const mcp = createMcpHandler({
  router: appRouter,
  createContext,
  toJsonSchema: (parser) => z.toJSONSchema(parser as z.ZodType, { io: "input" }),
  genericErrorMessage: GENERIC_ERROR_MESSAGE,
  server: { name: "sujstack", version: "0.0.0" },
})
