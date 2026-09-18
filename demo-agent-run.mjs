// Demo: drive the REAL thatmgmt-mcp server over stdio against a faithful stub
// API, recording the agent-visible transcript: health -> availability ->
// supplier quote -> prepare-registration (locked total with the 1% cut).
// No live network calls; the stub mirrors the real API's route semantics.
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DOMAIN = "myproject-demo-4821.com";

const api = http.createServer((req, res) => {
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
const port = api.address().port;

const server = spawn("node", [path.join(here, "src", "index.js")], {
  env: { ...process.env, TMGMT_API_KEY: "demo-key", TMGMT_BASE_URL: `http://127.0.0.1:${port}` },
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

await rpc("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "demo", version: "0" } });

console.log("=== agent: tmgmt_health ===");
console.log(text(await rpc("tools/call", { name: "tmgmt_health", arguments: {} })));
console.log("\n=== agent: domains_check_availability {domain} ===");
console.log(text(await rpc("tools/call", { name: "domains_check_availability", arguments: { domain: DOMAIN } })));
console.log("\n=== agent: domains_get_quote {domain} ===");
console.log(text(await rpc("tools/call", { name: "domains_get_quote", arguments: { domain: DOMAIN } })));
console.log("\n=== agent: domains_prepare_registration {domain} ===");
console.log(text(await rpc("tools/call", { name: "domains_prepare_registration", arguments: { domain: DOMAIN } })));

server.kill();
api.close();
