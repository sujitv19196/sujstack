import { mcp } from "../../../server/mcp/runtime"

// Stateless: no GET stream and no session to DELETE, so Next answers those with 405.
export const POST = mcp
