---
name: thatmgmt
description: >-
  use this when an agent needs a domain name: check availability, get a locked
  quote with the 1% fee printed plainly, prepare a registration plan, or work
  with portfolio and order tools through the ThatMgmt API
portability: portable
---

# thatmgmt

Check, price, and plan domain purchases through one agent-friendly API. No signup needed to try: availability, quotes, and capabilities are public.

Base URL: `https://api.thatmgmt.com`

## Try it with zero signup (no API key)

These three endpoints are public, read-only, and rate-limited per IP:

1. **Discover** what you can do:
   `GET /v1/public/capabilities`
   Returns the machine-readable list of every public route. Start here if you are unsure.
2. **Check availability**:
   `GET /v1/public/availability?domain=example.com`
   Returns `{ domain, available, definitive }`. Read-only. No account, no key.
3. **Get a locked quote**:
   `GET /v1/public/quote?domain=example.com&period=1`
   Returns wholesale cents, the itemized 1% platform-cut line, and the total. The quote is locked: the total you see is the total you pay.

Note: these public endpoints are live. If one returns 503, retry later.

## Price math (fair and printed plainly)

Every quote shows three numbers: wholesale cost, the flat 1% platform cut, and the total. No subscription. No tiers. Zero-charge operations (DNS edits, auto-renew toggles) stay free.

Worked example, 1-year `.com` registration:

- Wholesale: $12.99 (1299 cents)
- Platform cut: 1% = $0.13 (13 cents)
- Total: $13.12 (1312 cents)

The quote response carries `wholesaleCents`, `platformCutCents`, `platformCutBasisPoints` (100), and `totalCents`. Approvals and budgets bind to the total.

## Full flow with an API key (Bearer token)

When you hold a tenant API key, send it as `Authorization: Bearer <key>`.
Availability and quotes stay on the public endpoints; the key unlocks the
tenant-only tools.

1. **Check availability**: `GET /v1/public/availability?domain=example.com`
2. **Get the locked quote**: `GET /v1/public/quote?domain=example.com&period=1`
3. **Prepare the registration**: `GET /v1/domains/prepare-registration?domain=example.com&period=1`
   This returns the safety-checked plan. It never executes.
4. **Purchase**: not available yet. The API exposes no execute endpoints
   today, so nothing here can register, renew, or transfer a domain. The
   approval gate in `src/approval.js` is implemented and tested now, ready
   for the day execute routes exist: quote id passed back plus an explicit
   `approved: true` flag, or the call is refused. Nothing executes blindly.

The same pattern covers renewals and transfers: quote first, prepare
second, execute only when the platform enables it.

## MCP tools (this server)

These are the exact tool names the MCP server exposes. Public tools need no
key. Tenant tools need `TMGMT_API_KEY`.

Public, no key:

- `tmgmt_health`: liveness check (`GET /health/live`)
- `tmgmt_capabilities`: discover the public no-auth surface
  (`GET /v1/public/capabilities`)
- `domains_check_availability`: check if a domain is available
  (`GET /v1/public/availability`)
- `domains_get_quote`: locked price quote, step 1 of the flow
  (`GET /v1/public/quote`)

Tenant, key needed:

- `domains_suggest`: suggest alternative names
  (`GET /v1/domains/suggestions`)
- `domains_prepare_registration`: safety-checked plan, never executes,
  step 2 of the flow (`GET /v1/domains/prepare-registration`)
- `domains_list`: list portfolio domains (`GET /v1/domains`)
- `domains_dns`: inspect DNS records for a domain
  (`GET /v1/domains/{resourceId}/dns`)
- `portfolio_health`: portfolio health summary (`GET /v1/portfolio/health`)
- `portfolio_renewal_risk`: renewal-risk view
  (`GET /v1/portfolio/renewal-risk`)
- `portfolio_exceptions`: prioritized exception queue
  (`GET /v1/portfolio/exceptions`)
- `orders_dry_run`: full order plan with itemized pricing, never moves money
  (`POST /v1/orders/dry-run`)
- `offerings`: offering coverage matrix (`GET /v1/offerings`)

## Live limits (honest)

- Public reads never need a key and never touch your tenant.
- Purchase, renewal, and transfer execute only after the transaction path is enabled; before that, endpoints return validated plans, not orders.
- Supplier writes stay behind a kill switch. If a write is disabled, the API says so instead of failing silently.
- Every order is audit-logged. Crypto checkout keeps the buyer pseudonymous at the payment layer; the platform still records each order.

## Related

- MCP server: `@thatmgmt/mcp` (npm, publishing; source: this repo, `https://github.com/russfranky/thatmgmt-mcp`) exposes these flows as agent tools. Run it today via `git clone` + `node src/index.js`; `npx @thatmgmt/mcp` once the npm package is live.
- Full route reference: `https://thatmgmt.com/api.html` (OpenAPI).
