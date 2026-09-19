# Publish checklist: @thatmgmt/mcp 0.2.0

Run these steps the moment the npm retry cron reports a successful publish.
Each step is verifiable. Stop at the first failure and report it.

## 1. Verify the package on npm

- `npm view @thatmgmt/mcp version` returns `0.2.0`.
- `npm view @thatmgmt/mcp dist.tarball` returns a URL; `curl -sI` on that URL returns 200.
- Download the tarball and list it: it must contain exactly LICENSE, README.md, package.json, server.json, skills/thatmgmt/SKILL.md, and src/ (approval.js, index.js, thatmgmt.js, tools.js). Nothing else.

## 2. Smoke test the published package

In a temp dir (not the repo):

- `npx -y @thatmgmt/mcp` starts and lists tools over stdio.
- Keyless public tools work against https://api.thatmgmt.com: tmgmt_health, tmgmt_capabilities, domains_check_availability, domains_get_quote.
- Protected tools fail closed without TMGMT_API_KEY: the server refuses or returns 401 guidance, and never sends an Authorization header.

## 3. Tag the release

- Resolve the current `russfranky/thatmgmt-mcp` main HEAD live via the GitHub API (never use a hardcoded SHA).
- Push a lightweight tag `v0.2.0` pointing straight at that commit SHA via the Git Data API.
- Verify the remote ref `refs/tags/v0.2.0` matches the SHA.

## 4. Verify the registry workflow

- The tag push triggers the `publish-mcp.yml` workflow. Watch the run: tests must pass, server.json must validate, and mcp-publisher must publish without error.
- Confirm the server appears in the official MCP registry under `io.github.russfranky/thatmgmt-mcp`.

## 5. Clean up credentials and schedules

- Remove `~/.npmrc` (it holds a publish token).
- Remove the `thatmgmt-mcp-publish-retry` cron; it has served its purpose.

## 6. Tell Russ

- The three temporary npm tokens still need revoking on npmjs.com: `thatmgmt-mcp-publish-2026-09-18`, `thatmgmt-mcp-publish2-2026-09-18`, `thatmgmt-mcp-publish3-2026-09-18`. Revoking is a dashboard action the agent cannot do.
