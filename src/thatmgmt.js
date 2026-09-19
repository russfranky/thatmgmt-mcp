// Minimal HTTP client for the ThatMgmt API (https://api.thatmgmt.com).
// Auth: TMGMT_API_KEY is sent as a Bearer token. The key is never logged.

const DEFAULT_BASE_URL = "https://api.thatmgmt.com";
const DEFAULT_TIMEOUT_MS = 30000;
const RETRY_DELAY_MS = 400;

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

function parseTimeout(raw) {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export function createClient({ fetchFn = globalThis.fetch, env = process.env, timeoutMs } = {}) {
  const baseUrl = (env.TMGMT_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiKey = env.TMGMT_API_KEY || "";
  const timeout = timeoutMs ?? parseTimeout(env.TMGMT_TIMEOUT_MS) ?? DEFAULT_TIMEOUT_MS;
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

  // Retry rule: only side-effect-free calls are retried. Today that is every
  // GET plus the dry-run planner POST (a pure plan, never moves money).
  // Future execute tools must NOT be retried without an idempotency key.
  function isSideEffectFree(method, path) {
    if (method === "GET") return true;
    return method === "POST" && path === "/v1/orders/dry-run";
  }

  function isRetryableFailure(err) {
    if (!(err instanceof ThatMgmtError)) return false;
    if (err.status === 429) return true;
    if (err.status >= 500 && err.status < 600) return err.retryable !== false;
    return err.retryable === true && err.status === undefined;
  }

  async function attemptRequest(path, { params = {}, method = "GET", json } = {}) {
    const url = new URL(baseUrl + path);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const init = { method, headers: headers() };
    if (json !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(json);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    init.signal = controller.signal;
    let res;
    try {
      res = await fetchFn(url.toString(), init);
    } catch (err) {
      if (err && err.name === "AbortError") {
        throw new ThatMgmtError(
          `ThatMgmt API request timed out after ${timeout}ms (${method} ${path}).`,
          { retryable: true }
        );
      }
      throw new ThatMgmtError(`Network error calling ThatMgmt API: ${redact(err.message)}`, {
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
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
        retryable:
          res.status === 429 ||
          (res.status >= 500 && res.status < 600 && body.retryable !== false) ||
          body.retryable === true,
      });
    }
    return body;
  }

  async function request(path, { params = {}, method = "GET", json } = {}) {
    const opts = { params, method, json };
    try {
      return await attemptRequest(path, opts);
    } catch (err) {
      if (isSideEffectFree(method, path) && isRetryableFailure(err)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        return attemptRequest(path, opts);
      }
      throw err;
    }
  }

  return {
    get: (path, params) => request(path, { params }),
    post: (path, json) => request(path, { method: "POST", json }),
    health: () => request("/health/live"),
  };
}
