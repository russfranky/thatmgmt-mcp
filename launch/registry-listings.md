# Registry and directory listings

Status: PREPARED, not submitted. Per the sequencing rule, listings go out the
moment the execute-endpoint rollout is confirmed live, with the full toolset.
If execution is not live by end of day, submit the honest current-state
version below and note the upgrade path. Nothing here claims registration
capability the API does not have yet.

## Shared listing copy (honest current state)

- Name: ThatMgmt domain reseller
- Tagline: Check domain availability, get locked price quotes, and prepare
  domain registrations.
- Description: ThatMgmt is a domain reseller platform with an API first
  design. This MCP server wraps the API so an AI agent can check domain
  availability, get name suggestions, lock a price quote, and prepare a
  registration plan without touching a dashboard. Pricing is wholesale plus
  1% on registrations, renewals, and transfers, with no subscription and no
  tiers. Crypto checkout (USDC, ETH, SOL) or card. Anything that would spend
  money uses a two-step approval: the agent shows the human the locked price
  first, and nothing moves without an explicit approval. The server never
  executes blindly.
- Repo: https://github.com/russfranky/thatmgmt-mcp
- Install: git clone, npm install, set TMGMT_API_KEY, add to MCP client config
  (full steps in the repo README, under 5 minutes).
- Env vars: TMGMT_API_KEY (required, secret), TMGMT_BASE_URL (optional,
  defaults to https://api.thatmgmt.com).
- Suggested categories/tags: domains, dns, developer tools.

## Official MCP Registry

- Manifest: server.json in the repo root. Name io.github.russfranky/thatmgmt-mcp,
  validated against the registry schema (name pattern, 100-char description
  limit, snake_case registry_type, required fields all pass).
- Submission path: automatic. The `.github/workflows/publish-mcp.yml` workflow
  runs on version tag pushes (v*), validates the manifest, logs in via GitHub
  OIDC (no browser, no stored secret), and publishes. Namespace
  io.github.russfranky is verified automatically for this repo.
- Blockers before first publish:
  1. The npm package @thatmgmt/mcp must exist on the public npm
     registry, because the manifest references it. One-time owner step, free:
     `cd ~/workspace/thatmgmt-mcp && npm publish --access public`
     (needs npm access for the @thatmgmt scope).
  2. Per the sequencing rule, publish the execute-live 0.3.0 manifest, not
     this 0.2.0 read-only one, unless end of day arrives first.
- Upgrade path when execute ships: add the execute tools behind the approval
  gate, bump version to 0.2.0 in package.json and server.json, push, then
  `git tag v0.2.0 && git push origin v0.2.0`. The workflow does the rest.

## Smithery

- Needs a browser: sign in at smithery.ai with GitHub, choose Add Server,
  connect the russfranky/thatmgmt-mcp repo. Smithery deploys from the repo.
- Use the shared listing copy above. No submission made from here.

## mcp.so

- Needs a browser: mcp.so submission form. Use the shared listing copy above.
- No submission made from here.

## Glama

- Needs a browser: glama.ai/mcp, add server flow (GitHub connection).
- Use the shared listing copy above. No submission made from here.

## When the rollout confirms execute is live

Ping the distribution worker with "rollout live" and it will: add the execute
tools behind the two-step approval gate, re-run the 25+ tests, bump to 0.2.0,
push, tag v0.2.0 (fires the registry workflow), and submit the directory
listings with the execute-live copy.
