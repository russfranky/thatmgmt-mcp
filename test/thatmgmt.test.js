// Tests for the ThatMgmt HTTP client. The network is fully mocked.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClient, ThatMgmtError, getConfig } from "../src/thatmgmt.js";

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts);
  };
  fn.calls = calls;
  return fn;
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

describe("createClient", () => {
  it("builds the URL with query params and sends the Bearer token", async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, { ok: true }));
    const client = createClient({ fetchFn, env: { TMGMT_API_KEY: "secret-key-abc" } });
    await client.get("/v1/domains/availability", { domain: "example.com", optimizeFor: "SPEED" });
    const [call] = fetchFn.calls;
    assert.match(call.url, /\/v1\/domains\/availability\?/);
    assert.match(call.url, /domain=example\.com/);
    assert.match(call.url, /optimizeFor=SPEED/);
    assert.equal(call.opts.headers.Authorization, "Bearer secret-key-abc");
  });

  it("omits empty params", async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, {}));
    const client = createClient({ fetchFn, env: { TMGMT_API_KEY: "k" } });
    await client.get("/v1/domains/suggestions", { query: "brand", pageSize: undefined, tlds: "" });
    assert.match(fetchFn.calls[0].url, /query=brand/);
    assert.doesNotMatch(fetchFn.calls[0].url, /pageSize/);
    assert.doesNotMatch(fetchFn.calls[0].url, /tlds/);
  });

  it("gives a clear message on 401", async () => {
    const fetchFn = mockFetch(() => jsonResponse(401, { code: "unauthorized" }));
    const client = createClient({ fetchFn, env: {} });
    await assert.rejects(() => client.get("/v1/domains/quote", { domain: "x.com" }), (err) => {
      assert.ok(err instanceof ThatMgmtError);
      assert.match(err.message, /TMGMT_API_KEY/);
      assert.equal(err.status, 401);
      return true;
    });
  });

  it("never leaks the API key in error messages", async () => {
    const key = "super-secret-key-999";
    const fetchFn = mockFetch(async () => {
      throw new Error(`boom while using ${key} on the wire`);
    });
    const client = createClient({ fetchFn, env: { TMGMT_API_KEY: key } });
    await assert.rejects(() => client.get("/v1/domains", {}), (err) => {
      assert.doesNotMatch(err.message, /super-secret-key-999/);
      assert.match(err.message, /\[REDACTED\]/);
      return true;
    });
  });

  it("marks rate limits retryable", async () => {
    const fetchFn = mockFetch(() => jsonResponse(429, { code: "rate_limited", retryable: true }));
    const client = createClient({ fetchFn, env: { TMGMT_API_KEY: "k" } });
    await assert.rejects(() => client.get("/v1/domains", {}), (err) => {
      assert.equal(err.retryable, true);
      return true;
    });
  });

  it("health hits /health/live", async () => {
    const fetchFn = mockFetch(() => jsonResponse(200, { status: "ok" }));
    const client = createClient({ fetchFn, env: {} });
    const body = await client.health();
    assert.match(fetchFn.calls[0].url, /\/health\/live$/);
    assert.deepEqual(body, { status: "ok" });
  });
});

describe("getConfig", () => {
  it("defaults the base URL to the production API", () => {
    const saved = process.env.TMGMT_BASE_URL;
    delete process.env.TMGMT_BASE_URL;
    assert.equal(getConfig().baseUrl, "https://api.thatmgmt.com");
    if (saved !== undefined) process.env.TMGMT_BASE_URL = saved;
  });
});
