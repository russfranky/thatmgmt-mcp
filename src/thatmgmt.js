// Minimal HTTP client for the ThatMgmt API (https://api.thatmgmt.com).
// Auth: TMGMT_API_KEY is sent as a Bearer token. The key is never logged.

const DEFAULT_BASE_URL = "https://api.thatmgmt.com";

export class ThatMgmtError extends Error {
  constructor(message, { status, code, retryable } = {}) {
    super(message);
    this.name = "ThatMgmtError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function redactWith(apiKey) {
  return (value) => {
    if (typeof value !== "string") return value;
    if (apiKey && apiKey.length > 0 && value.includes(apiKey)) {
      return value.split(apiKey).join("[REDACTED]");
    }
    return value;
  };
}

function redact(value) {
  return redactWith(process.env.TMGMT_API_KEY)(value);
}

export function getConfig() {
  return {
    baseUrl: (process.env.TMGMT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    apiKey: process.env.TMGMT_API_KEY || "",
  };
}

export function createClient({ fetchFn = globalThis.fetch, env = process.env } = {}) {
  const baseUrl = (env.TMGMT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiKey = env.TMGMT_API_KEY || "";
  const redact = redactWith(apiKey);

  function headers() {
    const h = { Accept: "application/json" };
    if (apiKey) h.Authorization = `Bearer ${apiKey}`;
    return h;
  }

  function errorMessage(status, body) {
    const code = body && typeof body === "object" ? body.code : undefined;
    const detail = body && typeof body === "object" && body.message ? String(body.message) : "";
    switch (status) {
      case 401:
        return "Not authenticated. Set TMGMT_API_KEY to a valid ThatMgmt API key.";
      case 403:
        return "Access denied for this tenant or grant.";
      case 404:
        return "Unknown route or resource.";
      case 405:
        return "Method not allowed on this route.";
      case 409:
        return `Request refused: ${detail || code || "conflict"}.`;
      case 429:
        return "Rate limited. Wait and retry.";
      case 503:
        return "Route not wired on the server (auth or dependencies missing).";
      default:
        return detail || `Request failed with status ${status}.`;
    }
  }

  async function request(path, { params = {}, method = "GET" } = {}) {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    let res;
    try {
      res = await fetchFn(url.toString(), { method, headers: headers() });
    } catch (err) {
      throw new ThatMgmtError(`Network error calling ThatMgmt API: ${redact(err.message)}`, {
        retryable: true,
      });
    }
    let body;
    const text = await res.text();
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      const code = body && typeof body === "object" ? body.code : undefined;
      throw new ThatMgmtError(redact(errorMessage(res.status, body)), {
        status: res.status,
        code,
        retryable: res.status === 429 || (body && body.retryable === true),
      });
    }
    return body;
  }

  return {
    get: (path, params) => request(path, { params }),
    health: () => request("/health/live"),
  };
}
