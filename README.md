# thatmgmt-mcp

An MCP (Model Context Protocol) server that wraps the ThatMgmt domain API.
An AI agent in Cursor, Claude Code, or Replit can check availability, get name
suggestions, lock a price quote, and prepare a registration, all without
touching a dashboard.

Base API: https://api.thatmgmt.com
Spec: https://thatmgmt.com/openapi.json (47 routes)
Machine docs: https://thatmgmt.com/llms-full.txt

## Try it with zero signup (no API key)

The public reads need no key and no account. After `npm install`:

```sh
npx @thatmgmt/mcp
```

Then in your MCP client, call `tmgmt_capabilities` to see the public
surface, `domains_check_availability` to check a name, and
`domains_get_quote` for the locked price: wholesale plus the itemized 1%
platform cut, printed plainly. Example quote for a 1-year `.com`:
$12.99 wholesale + $0.13 cut = $13.12 total.

## Setup with an API key (tenant tools)

Prereqs: Node 18+.

```sh
git clone https://github.com/russfranky/thatmgmt-mcp.git thatmgmt-mcp
cd thatmgmt-mcp
npm install
export TMGMT_API_KEY="your-thatmgmt-api-key"
```

The key is only needed for tenant tools: name suggestions, portfolio
views, the dry-run planner, and prepare-registration. Everything else
works without it.

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

1. **Quote.** Call `domains_get_quote`. It returns the locked price:
   `wholesaleCents`, the itemized 1% cut (`platformCutCents`,
   `platformCutBasisPoints`), and `totalCents`. No key needed. Show this to
   the human.
2. **Plan.** Call `domains_prepare_registration` (needs `TMGMT_API_KEY`).
   It returns the safety-checked plan. It never executes anything.

Pricing: no subscription. A flat 1% cut applies to spend-effect actions only.
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

| Tool | What it does | API route | Key needed |
|---|---|---|---|
| `tmgmt_health` | Liveness check | `GET /health/live` | No |
| `tmgmt_capabilities` | Discover the public no-auth surface | `GET /v1/public/capabilities` | No |
| `domains_check_availability` | Check if a domain is available | `GET /v1/public/availability` | No |
| `domains_get_quote` | Locked price quote: wholesale + itemized 1% cut + total (step 1) | `GET /v1/public/quote` | No |
| `domains_suggest` | Suggest alternative names | `GET /v1/domains/suggestions` | Yes |
| `domains_prepare_registration` | Safety-checked plan, never executes (step 2) | `GET /v1/domains/prepare-registration` | Yes |
| `domains_list` | List portfolio domains | `GET /v1/domains` | Yes |
| `domains_dns` | Inspect DNS records for a domain | `GET /v1/domains/{resourceId}/dns` | Yes |
| `portfolio_health` | Portfolio health summary | `GET /v1/portfolio/health` | Yes |
| `portfolio_renewal_risk` | Renewal-risk view | `GET /v1/portfolio/renewal-risk` | Yes |
| `portfolio_exceptions` | Prioritized exception queue | `GET /v1/portfolio/exceptions` | Yes |
| `orders_dry_run` | Full order plan with itemized pricing, never moves money | `POST /v1/orders/dry-run` | Yes |
| `offerings` | Offering coverage matrix | `GET /v1/offerings` | Yes |

Public tools never send an Authorization header and never ask for a key.
Tenant tools return 401 without a key; the server tells you to set
`TMGMT_API_KEY`. The key is sent as a Bearer token and is never logged.

## Development

```sh
npm test   # 33 tests, mocked HTTP, no live calls
```

## Registry

`server.json` is the manifest for the official MCP registry
(`io.github.russfranky/thatmgmt-mcp`). It is published automatically by the
`publish-mcp` GitHub Actions workflow when a version tag (e.g. `v0.2.0`) is
pushed; the workflow validates the manifest against the registry schema and
authenticates the namespace via GitHub OIDC, so no manual login is needed.

Prerequisite the workflow cannot do itself: the `@thatmgmt/mcp`
npm package must exist on the public npm registry before the first publish,
since the manifest references it. Publish it once with `npm publish`
(requires npm access for the `@thatmgmt` scope), then push the version tag.
