# DO NOT POST until the execute-endpoint rollout is confirmed live.

This is the announcement for the day the API can execute registrations.
Swap it in for announcement-current.md only after the rollout worker reports
the transaction path live and verified.

---

# ThatMgmt: register a real domain from your AI agent

ThatMgmt is a domain reseller platform with an API first design. It is built
for AI agents, builders, and agencies that want to sell domains under their
own brand.

What you can do:

- Check domain availability in real time.
- Lock a price quote. The quote shows the full amount: wholesale plus 10%.
- Register a real domain through the API. Your agent shows you the locked
  price first and registers only with your explicit approval.
- Renew and transfer domains at the same wholesale plus 10%.
- Pay in crypto (USDC, ETH, or SOL) from any wallet, or pay by card. Each
  crypto order gets a unique deposit address.

Pricing is simple. Wholesale cost plus 10% on registrations, renewals, and
transfers. No subscription. No tiers. No upsells.

For agents: thatmgmt-mcp is an open source MCP server that wraps the API. An
agent in Cursor, Claude Code, or Replit can check availability, lock a quote,
and register a domain without touching a dashboard. Every spend-effect step
needs the locked quote id passed back plus an explicit approval flag, or the
server refuses.

Links:

- Platform: https://thatmgmt.com
- MCP server: https://github.com/russfranky/thatmgmt-mcp
- Machine docs: https://thatmgmt.com/llms.txt
- API spec: https://thatmgmt.com/openapi.json

---

When this goes live, also update:

- server.json description to mention registration execution (keep it under
  100 characters), bump version to 0.2.0 in server.json and package.json.
- README tool table: add the execute tools behind the approval gate.
- Push and tag v0.2.0. The publish-mcp workflow submits the new manifest to
  the official MCP registry automatically.
- Refresh the Smithery, mcp.so, and Glama listings with the new description.
