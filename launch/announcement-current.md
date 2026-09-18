# ThatMgmt: a domain reseller API your AI agent can use

ThatMgmt is a domain reseller platform with an API first design. It is built
for AI agents, builders, and agencies that want to work with domains without
touching a dashboard.

What works today:

- Check domain availability in real time.
- Get name suggestions when a domain is taken.
- Lock a price quote before you commit. The quote shows the full amount you pay.
- Prepare a registration plan with safety checks. The plan never runs on its own.
- Pay in crypto (USDC, ETH, or SOL) from any wallet, or pay by card. Each
  crypto order gets a unique deposit address. No card or bank account is needed
  to pay in crypto.

Pricing is simple. Wholesale cost plus 10% on registrations, renewals, and
transfers. No subscription. No tiers. No upsells.

For agents: thatmgmt-mcp is an open source MCP server that wraps the API. An
agent in Cursor, Claude Code, or Replit can check availability, get a locked
quote, and prepare a registration. Anything that spends money uses a two-step
approval: the agent shows the human the locked price first, and nothing moves
without an explicit approval.

Full registration execution is in rollout now. Today the API is read-only plus
validated plans. The complete path, quote to paid to registered, ships next.

Links:

- Platform: https://thatmgmt.com
- MCP server: https://github.com/russfranky/thatmgmt-mcp
- Machine docs: https://thatmgmt.com/llms.txt
- API spec: https://thatmgmt.com/openapi.json
