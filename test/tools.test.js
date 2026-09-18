// Tests for tool definitions, routing, and the approval gate.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOOL_DEFS, callTool } from "../src/tools.js";
import { buildGate, assertApproved } from "../src/approval.js";
import { ThatMgmtError } from "../src/thatmgmt.js";

function stubClient() {
  const calls = [];
  return {
    calls,
    get: async (path, params) => {
      calls.push({ method: "GET", path, params });
      return { path, params };
    },
    post: async (path, json) => {
      calls.push({ method: "POST", path, json });
      return { path, json };
    },
  };
}

describe("TOOL_DEFS", () => {
  it("exposes the expected tool set", () => {
    const names = TOOL_DEFS.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "domains_check_availability",
      "domains_dns",
      "domains_get_quote",
      "domains_list",
      "domains_prepare_registration",
      "domains_suggest",
      "offerings",
      "orders_dry_run",
      "portfolio_exceptions",
      "portfolio_health",
      "portfolio_renewal_risk",
      "tmgmt_health",
    ]);
  });

  it("every tool has a name, description, and JSON-schema input", () => {
    for (const t of TOOL_DEFS) {
      assert.ok(t.name, "name");
      assert.ok(t.description && t.description.length > 20, `description for ${t.name}`);
      assert.equal(t.inputSchema.type, "object", `schema for ${t.name}`);
    }
  });

  it("prepare_registration description says it never executes", () => {
    const t = TOOL_DEFS.find((d) => d.name === "domains_prepare_registration");
    assert.match(t.description, /never execute/i);
    assert.match(t.description, /show .* human/i);
  });

  it("quote description is honest about the missing platform fee", () => {
    const t = TOOL_DEFS.find((d) => d.name === "domains_get_quote");
    assert.match(t.description, /WITHOUT the platform fee/i);
    assert.match(t.description, /orders_dry_run/);
  });
});

describe("callTool routing", () => {
  it("routes availability with domain and optimizeFor", async () => {
    const client = stubClient();
    await callTool(client, "domains_check_availability", {
      domain: "example.com",
      optimizeFor: "ACCURACY",
    });
    assert.deepEqual(client.calls[0], {
      method: "GET",
      path: "/v1/domains/availability",
      params: { domain: "example.com", optimizeFor: "ACCURACY" },
    });
  });

  it("routes quote with period", async () => {
    const client = stubClient();
    await callTool(client, "domains_get_quote", { domain: "example.com", period: 2 });
    assert.deepEqual(client.calls[0], {
      method: "GET",
      path: "/v1/domains/quote",
      params: { domain: "example.com", period: 2 },
    });
  });

  it("routes prepare-registration to the plan endpoint", async () => {
    const client = stubClient();
    await callTool(client, "domains_prepare_registration", { domain: "example.com" });
    assert.equal(client.calls[0].path, "/v1/domains/prepare-registration");
  });

  it("encodes the resource id in the DNS path", async () => {
    const client = stubClient();
    await callTool(client, "domains_dns", { resourceId: "dom 123", type: "A" });
    assert.equal(client.calls[0].path, "/v1/domains/dom%20123/dns");
  });

  it("routes orders_dry_run as a POST with a JSON body", async () => {
    const client = stubClient();
    await callTool(client, "orders_dry_run", {
      action: "domains.register",
      fqdn: "example.com",
      periodYears: 2,
    });
    assert.deepEqual(client.calls[0], {
      method: "POST",
      path: "/v1/orders/dry-run",
      json: { action: "domains.register", fqdn: "example.com", periodYears: 2 },
    });
  });

  it("passes the transfer auth code through the dry-run body", async () => {
    const client = stubClient();
    await callTool(client, "orders_dry_run", {
      action: "domains.transfer",
      fqdn: "example.com",
      authCode: "code-123",
    });
    assert.equal(client.calls[0].method, "POST");
    assert.equal(client.calls[0].json.authCode, "code-123");
  });

  it("orders_dry_run description says it never moves money", async () => {
    const t = TOOL_DEFS.find((d) => d.name === "orders_dry_run");
    assert.match(t.description, /never moves money/i);
    assert.match(t.description, /locked total/i);
  });

  it("rejects unknown tools", async () => {
    const client = stubClient();
    await assert.rejects(() => callTool(client, "domains_register", {}), /Unknown tool/);
  });
});

describe("approval gate", () => {
  const quote = {
    quoteId: "q-1",
    domain: "example.com",
    totalPayableCents: 1430,
    feeFingerprint: "fp-abc",
  };

  it("builds a gate from a quote", () => {
    const gate = buildGate(quote);
    assert.equal(gate.quoteId, "q-1");
    assert.equal(gate.domain, "example.com");
    assert.equal(gate.totalPayableCents, 1430);
  });

  it("refuses to build a gate without a quote id", () => {
    assert.throws(() => buildGate({ domain: "example.com" }), ThatMgmtError);
    assert.throws(() => buildGate(null), ThatMgmtError);
  });

  it("refuses without a quote id passed back", () => {
    const gate = buildGate(quote);
    assert.throws(() => assertApproved({ gate, approved: true }), /quote id/i);
  });

  it("refuses without explicit approval", () => {
    const gate = buildGate(quote);
    assert.throws(
      () => assertApproved({ gate, quoteId: "q-1", approved: false }),
      /approval/i
    );
    assert.throws(() => assertApproved({ gate, quoteId: "q-1" }), /approval/i);
  });

  it("refuses a mismatched quote id", () => {
    const gate = buildGate(quote);
    assert.throws(
      () => assertApproved({ gate, quoteId: "q-2", approved: true }),
      /does not match/i
    );
  });

  it("passes with matching quote id and explicit approval", () => {
    const gate = buildGate(quote);
    const res = assertApproved({ gate, quoteId: "q-1", approved: true });
    assert.equal(res.ok, true);
  });
});
