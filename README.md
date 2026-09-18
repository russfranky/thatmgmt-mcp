# thatmgmt-mcp

An MCP (Model Context Protocol) server that wraps the ThatMgmt domain reseller API.
An AI agent in Cursor, Claude Code, or Replit can check availability, get name
suggestions, lock a price quote, and prepare a registration, all without
touching a dashboard.

Base API: https://api.thatmgmt.com
Spec: https://thatmgmt.com/openapi.json (47 routes)
Machine docs: https://thatmgmt.com/llms-full.txt

## Setup in under 5 minutes

Prereqs: Node 18+.

```sh
git clone https://github.com/russfranky/thatmgmt-mcp.git thatmgmt-mcp
cd thatmgmt-mcp
npm install
export TMGMT_API_KEY="your-thatmgmt-api-key"
```

Add to your MCP client config (Claude Code / Cursor):

```json
{
  "mcpServers": {
    "thatmgmt": {
      "command": "node",
      "args": ["/path/to/thatmgmt-mcp/src/index.js"],
      "env": { "TMGMT_API_KEY": "your-thatmgmt-api-key" }
    }
  }
}
```

Verify:

```sh
npm test
```

Optional: `TMGMT_BASE_URL` overrides the API base (default `https://api.thatmgmt.com`).

## The two-step purchase flow

Spend-effect actions never execute blindly. The intended flow, written into
every tool description so agents show the human the price first:

1. **Quote.** Call `domains_get_quote`. It returns the locked price
   (`totalPayableCents` plus a fee fingerprint). Show this to the human.
2. **Plan.** Call `domains_prepare_registration`. It returns the
   safety-checked plan. It never executes anything.

Pricing: no subscription. A flat 10% cut applies to registrations only.
Checkout options (crypto via Privy, or card/bank fallback) are arranged
outside this server.

## Important: what this server cannot do

The ThatMgmt API exposes **no execute endpoints**. Purchase, renewal,
transfer, and DNS changes are never executed by the API; the API returns
validated plans and preflights instead. This server therefore cannot
register, renew, or transfer a domain, and it will never claim it did.

`src/approval.js` holds the approval gate that future execute tools will
use: quote id passed back plus an explicit `approved: true` flag, or the
call is refused. The gate is implemented and tested now so the safety
design is ready the day execute routes exist.

## Tools

| Tool | What it does | API route |
|---|---|---|
| `tmgmt_health` | Liveness check, no key needed | `GET /health/live` |
| `domains_check_availability` | Check if a domain is available | `GET /v1/domains/availability` |
| `domains_suggest` | Suggest alternative names | `GET /v1/domains/suggestions` |
| `domains_get_quote` | Locked price quote (step 1) | `GET /v1/domains/quote` |
| `domains_prepare_registration` | Safety-checked plan, never executes (step 2) | `GET /v1/domains/prepare-registration` |
| `domains_list` | List portfolio domains | `GET /v1/domains` |
| `domains_dns` | Inspect DNS records for a domain | `GET /v1/domains/{resourceId}/dns` |
| `portfolio_health` | Portfolio health summary | `GET /v1/portfolio/health` |
| `portfolio_renewal_risk` | Renewal-risk view | `GET /v1/portfolio/renewal-risk` |
| `portfolio_exceptions` | Prioritized exception queue | `GET /v1/portfolio/exceptions` |
| `offerings` | Offering coverage matrix | `GET /v1/offerings` |

Authenticated routes return 401 without a key; the server tells you to set
`TMGMT_API_KEY`. The key is sent as a Bearer token and is never logged.

## Development

```sh
npm test   # 25 tests, mocked HTTP, no live calls
```

## Registry

`server.json` is the manifest for the official MCP registry
(`io.github.russfranky/thatmgmt-mcp`). It is published automatically by the
`publish-mcp` GitHub Actions workflow when a version tag (e.g. `v0.2.0`) is
pushed; the workflow validates the manifest against the registry schema and
authenticates the namespace via GitHub OIDC, so no manual login is needed.

Prerequisite the workflow cannot do itself: the `@thingscorp/thatmgmt-mcp`
npm package must exist on the public npm registry before the first publish,
since the manifest references it. Publish it once with `npm publish`
(requires npm access for the `@thingscorp` scope), then push the version tag.
