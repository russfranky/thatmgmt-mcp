// End-to-end test: spawn the real MCP server over stdio, point it at a stub
// HTTP API, and speak JSON-RPC. No live network calls.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "..", "src", "index.js");

let api;
let apiPort;
let seenAuth;

before(async () => {
  api = http.createServer((req, res) => {
    seenAuth = req.headers.authorization;
    const url = new URL(req.url, "http://x");
    let body = {};
    if (url.pathname === "/v1/domains/availability") {
      body = { domain: url.searchParams.get("domain"), available: true };
    } else if (url.pathname === "/health/live") {
      body = { status: "ok" };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  apiPort = api.address().port;
});

after(async () => {
  await new Promise((resolve) => api.close(resolve));
});

function startServer(env) {
  const base = { ...process.env };
  delete base.TMGMT_API_KEY; // tests control the key explicitly
  const child = spawn("node", [serverPath], {
    env: { ...base, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buf = "";
  const pending = new Map();
  let nextId = 1;
  child.stdout.on("data", (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    }
  });
  function send(method, params) {
    const id = nextId++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  function notify(method, params) {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }
  return { child, send, notify };
}

describe("MCP server over stdio", () => {
  it("lists tools, calls one, and passes the Bearer token", async () => {
    const { child, send, notify } = startServer({
      TMGMT_API_KEY: "test-key-123",
      TMGMT_BASE_URL: `http://127.0.0.1:${apiPort}`,
    });
    try {
      const init = await send("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      });
      assert.ok(init.result.serverInfo);
      notify("notifications/initialized", {});

      const list = await send("tools/list", {});
      const names = list.result.tools.map((t) => t.name);
      assert.ok(names.includes("domains_check_availability"));
      assert.ok(names.includes("domains_get_quote"));
      assert.ok(names.includes("domains_prepare_registration"));
      assert.equal(names.length, 11);

      const call = await send("tools/call", {
        name: "domains_check_availability",
        arguments: { domain: "example.com" },
      });
      assert.equal(call.result.isError, undefined);
      const text = call.result.content[0].text;
      assert.match(text, /example\.com/);
      assert.match(text, /"available": true/);
      assert.equal(seenAuth, "Bearer test-key-123");
    } finally {
      child.kill();
    }
  });

  it("refuses authenticated tools without an API key", async () => {
    const { child, send, notify } = startServer({
      TMGMT_BASE_URL: `http://127.0.0.1:${apiPort}`,
    });
    try {
      await send("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      });
      notify("notifications/initialized", {});
      const call = await send("tools/call", {
        name: "domains_get_quote",
        arguments: { domain: "example.com" },
      });
      assert.equal(call.result.isError, true);
      assert.match(call.result.content[0].text, /TMGMT_API_KEY/);
    } finally {
      child.kill();
    }
  });

  it("reports missing required arguments", async () => {
    const { child, send, notify } = startServer({
      TMGMT_API_KEY: "k",
      TMGMT_BASE_URL: `http://127.0.0.1:${apiPort}`,
    });
    try {
      await send("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0" },
      });
      notify("notifications/initialized", {});
      const call = await send("tools/call", {
        name: "domains_check_availability",
        arguments: {},
      });
      assert.equal(call.result.isError, true);
      assert.match(call.result.content[0].text, /Missing required/);
    } finally {
      child.kill();
    }
  });
});
