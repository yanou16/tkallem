import { API_URL } from "@/lib/config";

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/* ---------- auth: the Clerk session token, sent as a Bearer token ---------- */
let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  authTokenProvider = provider;
}

/* ---------- 401 handling ---------- */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

type Options = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
  /** Skip the global 401 redirect. */
  skipAuthRedirect?: boolean;
};

function buildUrl(endpoint: string, query?: Options["query"]) {
  const url = `${API_URL}${endpoint}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** FastAPI puts the reason in `detail`: a string, or a list of issues for a validation error (422). */
export function errorMessage(data: unknown, status: number): string {
  const detail = data && typeof data === "object" ? (data as { detail?: unknown }).detail : undefined;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    if (first && typeof first === "object" && typeof (first as { msg?: unknown }).msg === "string") {
      return (first as { msg: string }).msg;
    }
  }
  return `Request failed (${status})`;
}

export async function apiFetch<T>(endpoint: string, options: Options = {}): Promise<T> {
  const { body, query, skipAuthRedirect, headers, token: requestToken, ...rest } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (body !== undefined && !isForm) finalHeaders.set("Content-Type", "application/json");
  const token = requestToken ?? (await authTokenProvider?.()) ?? null;
  if (token) finalHeaders.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(buildUrl(endpoint, query), {
      ...rest,
      headers: finalHeaders,
      credentials: "omit",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) onUnauthorized?.();
    throw new ApiError(errorMessage(data, res.status), res.status, data);
  }
  return data as T;
}

export const api = {
  get: <T>(url: string, o?: Options) => apiFetch<T>(url, { ...o, method: "GET" }),
  post: <T>(url: string, body?: unknown, o?: Options) => apiFetch<T>(url, { ...o, method: "POST", body }),
  put: <T>(url: string, body?: unknown, o?: Options) => apiFetch<T>(url, { ...o, method: "PUT", body }),
  patch: <T>(url: string, body?: unknown, o?: Options) => apiFetch<T>(url, { ...o, method: "PATCH", body }),
  delete: <T>(url: string, o?: Options) => apiFetch<T>(url, { ...o, method: "DELETE" }),
};
