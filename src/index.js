#!/usr/bin/env node
// ThatMgmt MCP server (stdio).
// Wraps the ThatMgmt domain reseller API: https://api.thatmgmt.com
// Auth: TMGMT_API_KEY env var, sent as a Bearer token. Never logged.
// Only tenant tools need the key. The public tools (tmgmt_health,
// tmgmt_capabilities, domains_check_availability, domains_get_quote) hit the
// no-auth /v1/public/* endpoints and work with zero signup.
//
// Two-step purchase flow (documented in tool descriptions):
//   1. domains_get_quote -> locked price (wholesale plus the itemized 1% cut),
//      show it to the human.
//   2. domains_prepare_registration -> safety-checked plan, never executes.
// The API exposes no execute endpoints for register/renew/transfer, so this
// server never spends money. When execute routes exist, spend-effect tools
// will require the quote id plus an explicit approval flag (see approval.js).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient, ThatMgmtError, getConfig } from "./thatmgmt.js";
import { TOOL_DEFS, callTool } from "./tools.js";

const SERVER_INSTRUCTIONS = [
  "ThatMgmt domain reseller API: check availability, get locked quotes with",
  "the 1% fee printed plainly, and prepare registrations. Read-only plus",
  "validated plans.",
  "",
  "Zero signup to try: tmgmt_health, tmgmt_capabilities,",
  "domains_check_availability, and domains_get_quote need no API key. Start",
  "with tmgmt_capabilities to see the public surface.",
  "",
  "Two-step purchase flow: (1) call domains_get_quote and SHOW THE HUMAN the",
  "locked price (domain, wholesale, 1% cut, total) before anything else;",
  "(2) call domains_prepare_registration for the safety-checked plan.",
  "",
  "IMPORTANT: the ThatMgmt API has no execute endpoints. Purchase, renewal,",
  "transfer, and DNS changes are never executed by the API or this server.",
  "Tenant tools (portfolio, suggestions, dry-run, prepare-registration) need",
  "TMGMT_API_KEY. Never claim a domain was registered. Report the plan and",
  "hand the human the locked quote for their own checkout.",
].join("\n");

const server = new Server(
  { name: "thatmgmt-mcp", version: "0.2.0" },
  { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

function checkRequired(def, args) {
  const required = def.inputSchema.required || [];
  const missing = required.filter(
    (k) => args[k] === undefined || args[k] === null || args[k] === ""
  );
  if (missing.length > 0) {
    throw new ThatMgmtError(`Missing required argument(s): ${missing.join(", ")}.`);
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    checkRequired(def, args);
    const config = getConfig();
    if (!config.apiKey && !def.public) {
      throw new ThatMgmtError(
        "TMGMT_API_KEY is not set. This tool needs a tenant API key. " +
          "The public tools (tmgmt_health, tmgmt_capabilities, " +
          "domains_check_availability, domains_get_quote) work without one."
      );
    }
    const client = createClient();
    const result = await callTool(client, name, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`thatmgmt-mcp failed to start: ${err.message}\n`);
  process.exit(1);
});
