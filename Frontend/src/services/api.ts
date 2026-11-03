import type { ApiEnvelope } from "../types/api";
import { isObj, type Obj } from "../utils/data";

/*
 * Every backend call lives in this file (see the `api` object at the bottom).
 * VITE_API_BASE_URL may be relative ("/api/v1", served via the Vite dev proxy or a reverse
 * proxy) or absolute ("https://api.example.com/api/v1").
 */
const DEFAULT_BASE = "/api/v1";

function normalizeBase(raw: string | undefined): string {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!v) return DEFAULT_BASE;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(v) || v.startsWith("//")) return v; // absolute
  return v.startsWith("/") ? v : `/${v}`;
}

export const API_BASE_URL: string = normalizeBase(import.meta.env.VITE_API_BASE_URL);
export const API_BASE_IS_RELATIVE: boolean = API_BASE_URL.startsWith("/") && !API_BASE_URL.startsWith("//");

/** The backend analysis is synchronous and can take several minutes. */
export const ANALYZE_TIMEOUT_MS = 1200000;

export const STATUS_HINTS: Record<number, string> = {
  404: "Not found. The tender or resource does not exist on the backend.",
  409: "Conflict. The tender is not in a state that allows this action (for example, analysis already running or not finished).",
  413: "File too large. The maximum upload size is 25 MB.",
  415: "Unsupported file type. Upload a PDF, DOCX or TXT document.",
  422: "Validation error. The backend rejected the request data.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Internal server error on the backend.",
  503: "The backend or one of its services is temporarily unavailable.",
};

const PROXY_HINT =
  "If you are using the Vite dev server, this usually means its /api/v1 proxy could not reach the FastAPI backend " +
  "(DEV_PROXY_TARGET, default http://127.0.0.1:8000). Check that the backend is running.";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Query = Record<string, string | number | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: BodyInit;
  json?: unknown;
  query?: Query;
  timeoutMs?: number;
}

/** Builds the request URL. Relative bases resolve against the page origin; absolute bases are used as-is. */
export function buildApiUrl(path: string, query?: Query): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${p}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function errorMessage(payload: unknown, status: number): string {
  if (isObj(payload)) {
    if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
    if (typeof payload.detail === "string" && payload.detail.trim()) return payload.detail;
  }
  return STATUS_HINTS[status] || `Request failed with HTTP ${status}.`;
}

function appendDetail(details: unknown, extra: string): unknown {
  if (details === undefined || details === null || details === "") return extra;
  if (typeof details === "string") return `${details}\n\n${extra}`;
  return details;
}

/** Centralised API client. Unwraps the {success, message, data} envelope and normalises errors. */
export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<ApiEnvelope<T>> {
  const { method = "GET", body, json, query, timeoutMs = 60000 } = options;
  const url = buildApiUrl(path, query);

  const headers: Record<string, string> = { Accept: "application/json" };
  let payloadBody: BodyInit | undefined = body; // FormData: the browser sets the multipart boundary
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    payloadBody = JSON.stringify(json);
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: payloadBody, signal: controller.signal });
  } catch {
    window.clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new ApiError(`The request timed out after ${Math.round(timeoutMs / 1000)} seconds.`, 0, "TIMEOUT");
    }
    throw new ApiError(
      API_BASE_IS_RELATIVE
        ? `Cannot reach ${window.location.origin}${API_BASE_URL}. Make sure the frontend server is running and /api/v1 is routed to FastAPI.`
        : `Cannot reach the backend at ${API_BASE_URL}. Make sure FastAPI is running and that its CORS settings allow ${window.location.origin}.`,
      0,
      "NETWORK_ERROR"
    );
  }

  let text = "";
  try {
    text = await res.text();
  } catch {
    text = "";
  } finally {
    window.clearTimeout(timer);
  }

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  const looksHtml = /^\s*</.test(text);

  const envelopeFailed = isObj(payload) && payload.success === false;
  if (!res.ok || envelopeFailed) {
    const data: Obj = isObj(payload) && isObj(payload.data) ? payload.data : {};
    const code = typeof data.error_code === "string" ? data.error_code : undefined;
    const message = errorMessage(payload, res.status);
    const detail = isObj(payload) ? payload.detail : undefined;
    let details: unknown = data.details ?? (detail !== message ? detail : undefined);
    if (payload === null && text && !looksHtml && details === undefined) details = text.slice(0, 500);
    if (payload === null && API_BASE_IS_RELATIVE && res.status >= 500) details = appendDetail(details, PROXY_HINT);
    throw new ApiError(message, res.status, code, details);
  }

  if (!isObj(payload)) {
    throw new ApiError(
      looksHtml
        ? `Expected JSON from ${url} but received an HTML page. /api/v1 is not being routed to the FastAPI backend (check the dev proxy, your reverse proxy or VITE_API_BASE_URL).`
        : "The backend returned an empty or non-JSON response.",
      res.status,
      "INVALID_RESPONSE",
      looksHtml ? undefined : text.slice(0, 500) || undefined
    );
  }
  if (!("data" in payload)) return { success: true, message: "", data: payload as T };
  return payload as unknown as ApiEnvelope<T>;
}

const enc = (id: string) => encodeURIComponent(id);

/** All backend endpoints used by the frontend. */
export const api = {
  health: () => request<any>("/health", { timeoutMs: 10000 }),
  uploadTender: (file: File) => {
    const form = new FormData();
    form.append("file", file); // field name must be exactly "file"
    return request<any>("/tenders/upload", { method: "POST", body: form, timeoutMs: 180000 });
  },
  listTenders: (page: number, pageSize: number) => request<any>("/tenders", { query: { page, page_size: pageSize } }),
  getTender: (id: string) => request<any>(`/tenders/${enc(id)}`),
  analyzeTender: (id: string) => request<any>(`/tenders/${enc(id)}/analyze`, { method: "POST", timeoutMs: ANALYZE_TIMEOUT_MS }),
  getTenderStatus: (id: string) => request<any>(`/tenders/${enc(id)}/status`, { timeoutMs: 20000 }),
  getRequirements: (id: string) => request<any>(`/tenders/${enc(id)}/requirements`),
  getReport: (id: string) => request<any>(`/tenders/${enc(id)}/report`, { timeoutMs: 120000 }),
  askQuestion: (id: string, question: string) =>
    request<any>(`/tenders/${enc(id)}/questions`, { method: "POST", json: { question }, timeoutMs: 180000 }),
};

export const getHealth = api.health;

export interface ErrorInfo {
  message: string;
  status?: number;
  code?: string;
  details?: string;
  hint?: string;
}

function stringifyDetails(d: unknown): string | undefined {
  if (d === null || d === undefined || d === "") return undefined;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((x) =>
        isObj(x) && x.msg
          ? `${(Array.isArray(x.loc) ? x.loc.join(".") : "") || "field"}: ${x.msg}`
          : typeof x === "string"
          ? x
          : JSON.stringify(x)
      )
      .join("\n");
  }
  return JSON.stringify(d, null, 2);
}

export function describeError(err: unknown): ErrorInfo {
  if (err instanceof ApiError) {
    const hint = err.status && STATUS_HINTS[err.status] && STATUS_HINTS[err.status] !== err.message ? STATUS_HINTS[err.status] : undefined;
    return { message: err.message, status: err.status || undefined, code: err.code, details: stringifyDetails(err.details), hint };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "An unexpected error occurred." };
}
