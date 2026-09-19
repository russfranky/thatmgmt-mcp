// Demo: drive the REAL thatmgmt-mcp server over stdio and record the
// agent-visible transcript: health -> availability -> supplier quote ->
// prepare-registration (locked total with the 1% cut).
//
// Default mode: no live network calls. A local stub server mirrors the real
// API's route semantics and the MCP server points at it via TMGMT_BASE_URL.
//
// Live mode: `node demo-agent-run.mjs --live`. The MCP server points at the
// real API (https://api.thatmgmt.com). Only the public no-key tools are
// called live; the tenant tool is called without TMGMT_API_KEY and must fail
// closed (the server refuses it before any network call). Read-only only:
// nothing is purchased, registered, or changed.
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DOMAIN = "myproject-demo-4821.com";
const LIVE = process.argv.includes("--live");

let baseUrl;
let api = null;
if (LIVE) {
  baseUrl = "https://api.thatmgmt.com";
} else {
  api = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const q = url.searchParams;
    let body;
    if (url.pathname === "/health/live") {
      body = { status: "ok" };
    } else if (url.pathname === "/v1/public/availability") {
      body = { action: "public.availability", domain: q.get("domain"), available: true, definitive: true };
    } else if (url.pathname === "/v1/public/quote") {
      // Public locked quote: wholesale plus the itemized 1% platform cut.
      body = {
        action: "public.quote",
        domain: q.get("domain"), periodYears: 1, available: true, currency: "USD",
        wholesaleCents: 1299,
        fees: [{ type: "platform_cut", amountCents: 13 }],
        platformCutCents: 13, platformCutBasisPoints: 100, totalCents: 1312,
      };
    } else if (url.pathname === "/v1/public/capabilities") {
      body = {
        action: "public.capabilities",
        routes: [
          { method: "GET", path: "/v1/public/availability", summary: "No-auth availability check." },
          { method: "GET", path: "/v1/public/quote", summary: "No-auth locked quote." },
          { method: "GET", path: "/v1/public/capabilities", summary: "No-auth route inventory." },
        ],
      };
    } else if (url.pathname === "/v1/domains/prepare-registration") {
      // Preflight WITH the platform_cut fee line (matches platform-cut.ts).
      body = {
        action: "domains.prepareRegistration",
        plan: {
          fqdn: q.get("domain"), periodYears: 1, currency: "USD",
          wholesaleCents: 1299,
          fees: [{ type: "platform_cut", amountCents: 13, note: "flat 1% platform cut" }],
          totalPayableCents: 1312,
          wouldExecute: false,
        },
        operatorSummary: "ready=false fqdn=myproject-demo-4821.com totalPayableCents=1312 wouldExecute=false",
      };
    } else {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "not_found" } }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise((r) => api.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${api.address().port}`;
}

console.log(LIVE ? "mode: live (https://api.thatmgmt.com, read-only, no API key)" : "mode: stub (local, no network)");

const env = { ...process.env, TMGMT_BASE_URL: baseUrl };
if (LIVE) {
  // Keyless on purpose: the tenant tool must fail closed.
  delete env.TMGMT_API_KEY;
} else {
  env.TMGMT_API_KEY = "demo-key";
}
const server = spawn("node", [path.join(here, "src", "index.js")], {
  env,
  stdio: ["pipe", "pipe", "inherit"],
});

let id = 0;
const pending = new Map();
let buf = "";
server.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
function rpc(method, params) {
  return new Promise((resolve) => {
    const myId = ++id;
    pending.set(myId, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
  });
}
const text = (res) => res.result?.content?.map((c) => c.text).join("\n") ?? JSON.stringify(res);
const failed = (res) => res.error || res.result?.isError;

await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "demo", version: "0" } });

let exitCode = 0;
async function step(label, name, args, expectFailClosed) {
  console.log(`\n=== agent: ${label} ===`);
  const res = await rpc("tools/call", { name, arguments: args });
  console.log(text(res));
  if (expectFailClosed) {
    if (!failed(res) || !text(res).includes("TMGMT_API_KEY")) {
      console.error("FAIL: protected tool did not fail closed without a key");
      exitCode = 1;
    } else {
      console.log("(fail-closed as expected: no key, no network write)");
    }
  } else if (failed(res)) {
    console.error(`FAIL: public tool ${name} errored`);
    exitCode = 1;
  }
}

await step("tmgmt_health", "tmgmt_health", {});
await step("domains_check_availability {domain}", "domains_check_availability", { domain: DOMAIN });
await step("domains_get_quote {domain}", "domains_get_quote", { domain: DOMAIN });
await step(
  LIVE ? "domains_prepare_registration {domain} (tenant tool, keyless: must fail closed)"
       : "domains_prepare_registration {domain} (tenant tool, demo key)",
  "domains_prepare_registration",
  { domain: DOMAIN },
  LIVE // in live mode this must fail closed; the stub still honors the demo key
);

server.kill();
if (api) api.close();
process.exit(exitCode);
