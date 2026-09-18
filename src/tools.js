// Tool definitions for the ThatMgmt MCP server.
// Every tool maps to a real route in the live OpenAPI spec
// (https://thatmgmt.com/openapi.json). No invented endpoints.
//
// Spend-effect actions (register, renew, transfer) have NO execute endpoints
// in the API: purchase, renewal, transfer, and DNS changes are never executed.
// The closest real flow is:
//   orders_dry_run -> one call, full plan: itemized pricing (wholesale plus
//     the platform fee), readiness checklist, gated state, next steps.
//     The total shown is the locked total the approval binds to.
//   (legacy two-step) domains_get_quote -> supplier quote (no platform fee)
//     then domains_prepare_registration -> safety-checked plan.
// Show the human the plan first. Execution happens outside this server until
// the API exposes execute routes.

const EXECUTE_GAP_NOTE =
  "Note: the ThatMgmt API does not expose an execute endpoint for this action " +
  "(purchase, renewal, transfer, and DNS changes are never executed by the API). " +
  "This tool returns the validated plan only. Show the locked price to the human first.";

export const TOOL_DEFS = [
  {
    name: "tmgmt_health",
    description:
      "Check that the ThatMgmt API is reachable. No API key needed. Use it to verify setup.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    path: "/health/live",
    params: () => ({}),
  },
  {
    name: "domains_check_availability",
    description:
      "Check whether a domain name is available to register. Read-only. " +
      "Pass the fully qualified domain name, e.g. \"example.com\". " +
      "Set optimizeFor to SPEED for a fast check or ACCURACY for a careful one.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Fully qualified domain name, e.g. example.com" },
        optimizeFor: { type: "string", enum: ["SPEED", "ACCURACY"], description: "SPEED or ACCURACY" },
      },
      required: ["domain"],
      additionalProperties: false,
    },
    path: "/v1/domains/availability",
    params: (a) => ({ domain: a.domain, optimizeFor: a.optimizeFor }),
  },
  {
    name: "domains_suggest",
    description:
      "Suggest alternative domain names for a search query. Read-only. " +
      "Optionally filter by comma-separated TLDs, e.g. \"com,io\".",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query, e.g. a brand name" },
        pageSize: { type: "integer", minimum: 1, description: "How many suggestions to return" },
        tlds: { type: "string", description: "Comma-separated TLD filter, e.g. com,io" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    path: "/v1/domains/suggestions",
    params: (a) => ({ query: a.query, pageSize: a.pageSize, tlds: a.tlds }),
  },
  {
    name: "domains_get_quote",
    description:
      "Get the supplier price quote for registering a domain, without purchasing anything. " +
      "Read-only. Note: this is the supplier total WITHOUT the platform fee. " +
      "For the final price the approval binds to (wholesale plus the platform fee, itemized), " +
      "use orders_dry_run instead.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Fully qualified domain name, e.g. example.com" },
        period: { type: "integer", minimum: 1, description: "Registration period in years (default 1)" },
      },
      required: ["domain"],
      additionalProperties: false,
    },
    path: "/v1/domains/quote",
    params: (a) => ({ domain: a.domain, period: a.period }),
  },
  {
    name: "domains_prepare_registration",
    description:
      "Prepare (never execute) a domain registration: returns the safety-checked plan only. " +
      "Step 2 of the two-step purchase flow. Show the plan, with the locked total and fee, " +
      "to the human first. " + EXECUTE_GAP_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Fully qualified domain name, e.g. example.com" },
        period: { type: "integer", minimum: 1, description: "Registration period in years (default 1)" },
      },
      required: ["domain"],
      additionalProperties: false,
    },
    path: "/v1/domains/prepare-registration",
    params: (a) => ({ domain: a.domain, period: a.period }),
  },
  {
    name: "domains_list",
    description:
      "List domain resources in the tenant portfolio (paginated). Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        pageSize: { type: "integer", minimum: 1, description: "Page size" },
        pageToken: { type: "string", description: "Opaque pagination cursor from a previous call" },
      },
      additionalProperties: false,
    },
    path: "/v1/domains",
    params: (a) => ({ pageSize: a.pageSize, pageToken: a.pageToken }),
  },
  {
    name: "domains_dns",
    description:
      "Inspect DNS records for a domain resource. Read-only; use the resource id " +
      "from domains_list. Optionally filter by record type (A, CNAME, ...) or name.",
    inputSchema: {
      type: "object",
      properties: {
        resourceId: { type: "string", description: "Server-side domain resource id" },
        type: { type: "string", description: "Record type filter, e.g. A, CNAME" },
        name: { type: "string", description: "Record name filter" },
      },
      required: ["resourceId"],
      additionalProperties: false,
    },
    path: (a) => `/v1/domains/${encodeURIComponent(a.resourceId)}/dns`,
    params: (a) => ({ type: a.type, name: a.name }),
  },
  {
    name: "portfolio_health",
    description:
      "Domain portfolio health summary for the tenant. Read-only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    path: "/v1/portfolio/health",
    params: () => ({}),
  },
  {
    name: "portfolio_renewal_risk",
    description:
      "Renewal-risk view over the domain portfolio: which domains need attention " +
      "before they expire. Read-only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    path: "/v1/portfolio/renewal-risk",
    params: () => ({}),
  },
  {
    name: "portfolio_exceptions",
    description:
      "Prioritized operator exception queue derived from portfolio health " +
      "(expiring certificates, commerce issues). Read-only, GET-only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    path: "/v1/portfolio/exceptions",
    params: () => ({}),
  },
  {
    name: "orders_dry_run",
    description:
      "Plan a domain order in one call: register, renew, or transfer. Returns the full " +
      "plan with itemized pricing (wholesale plus the platform fee as separate lines), " +
      "the readiness checklist with machine-readable reason codes, what is still gated, " +
      "and the next steps. The total shown is the locked total your approval binds to. " +
      "Never moves money and never touches the supplier. For transfers, pass the " +
      "authorization code only to check readiness; it is presence-checked, never stored. " +
      EXECUTE_GAP_NOTE,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["domains.register", "domains.renew", "domains.transfer"],
          description: "The order action to plan",
        },
        fqdn: { type: "string", description: "Fully qualified domain name, e.g. example.com" },
        periodYears: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Registration/renewal period in years (default 1)",
        },
        authCode: {
          type: "string",
          description:
            "Transfer authorization code (transfer only). Presence-checked for readiness; " +
            "never logged or stored by the API.",
        },
      },
      required: ["action", "fqdn"],
      additionalProperties: false,
    },
    method: "POST",
    path: "/v1/orders/dry-run",
    params: (a) => {
      const body = { action: a.action, fqdn: a.fqdn };
      if (a.periodYears !== undefined) body.periodYears = a.periodYears;
      if (a.authCode !== undefined) body.authCode = a.authCode;
      return body;
    },
  },
  {
    name: "offerings",
    description:
      "Reseller offering coverage matrix: every supplier family, its exposed routes, " +
      "entitlement state, and write-gating. Read-only. Useful to see what this " +
      "tenant is entitled to.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    path: "/v1/offerings",
    params: () => ({}),
  },
];

export async function callTool(client, name, args) {
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) throw new Error(`Unknown tool: ${name}`);
  const path = typeof def.path === "function" ? def.path(args) : def.path;
  if (def.method === "POST") {
    return client.post(path, def.params(args));
  }
  return client.get(path, def.params(args));
}
