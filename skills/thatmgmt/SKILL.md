---
name: thatmgmt
description: >-
  use this when an agent needs a domain name: check availability, get a locked
  quote with the 1% fee printed plainly, prepare a registration, or buy and
  manage domains through the ThatMgmt API
portability: portable
---

# thatmgmt

Buy and manage internet infrastructure through one agent-friendly API. No signup needed to try: availability, quotes, and capabilities are public.

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

Note: these public endpoints are live. If one returns 503, retry later or use the bearer path below.

## Price math (fair and printed plainly)

Every quote shows three numbers: wholesale cost, the flat 1% platform cut, and the total. No subscription. No tiers. Zero-charge operations (DNS edits, auto-renew toggles) stay free.

Worked example, 1-year `.com` registration:

- Wholesale: $12.99 (1299 cents)
- Platform cut: 1% = $0.13 (13 cents)
- Total: $13.12 (1312 cents)

The quote response carries `wholesaleCents`, `platformCutCents`, `platformCutBasisPoints` (100), and `totalCents`. Approvals and budgets bind to the total.

## Full flow with an API key (Bearer token)

When you hold a tenant API key, send it as `Authorization: Bearer <key>`:

1. **Check availability**: `GET /v1/domains/availability?domain=example.com`
2. **Get the locked quote**: `GET /v1/domains/quote?domain=example.com&period=1`
3. **Prepare the registration**: `GET /v1/domains/prepare-registration?domain=example.com&period=1`
   This returns the safety-checked plan. It never executes.
4. **Purchase**: only when the transaction path is enabled for your tenant. The purchase endpoint validates the locked quote, takes crypto or card payment, and returns the order record. Until the transaction path is live, purchase calls return a validated plan and a clear "not yet enabled" answer. Nothing executes blindly.

The same pattern covers renewals and transfers: quote first, prepare second, execute only when enabled.

## Live limits (honest)

- Public reads never need a key and never touch your tenant.
- Purchase, renewal, and transfer execute only after the transaction path is enabled; before that, endpoints return validated plans, not orders.
- Supplier writes stay behind a kill switch. If a write is disabled, the API says so instead of failing silently.
- Every order is audit-logged. Crypto checkout keeps the buyer pseudonymous at the payment layer; the platform still records each order.

## Related

- MCP server: `@thatmgmt/mcp` (npm, publishing; source: this repo, `https://github.com/russfranky/thatmgmt-mcp`) exposes these flows as agent tools. Run it today via `git clone` + `node src/index.js`; `npx @thatmgmt/mcp` once the npm package is live.
- Full route reference: `https://thatmgmt.com/api.html` (OpenAPI).
