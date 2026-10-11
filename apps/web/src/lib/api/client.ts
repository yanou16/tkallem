import { API_URL, AUTH_MODE } from "@/lib/config";

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

/* ---------- token storage (only used when AUTH_MODE === "bearer") ---------- */
const TOKEN_KEY = "tkallem.token";
let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  authTokenProvider = provider;
}

export const tokenStore = {
  get(): string | null {
    if (AUTH_MODE !== "bearer" || typeof window === "undefined") return null;
    try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set(token: string) {
    if (AUTH_MODE !== "bearer" || typeof window === "undefined") return;
    try { window.localStorage.setItem(TOKEN_KEY, token); } catch {}
  },
  clear() {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(TOKEN_KEY); } catch {}
  },
};

/* ---------- guest token (visitor without account, see docs/CREDITS.md) ---------- */
const GUEST_KEY = "tkallem.guest";
export const GUEST_EVENT = "tkallem:guest-changed";
let guestCreationFailed = false;
export const guestFailure = {
  get: () => guestCreationFailed,
  set(value: boolean) {
    guestCreationFailed = value;
    if (typeof window !== "undefined") window.dispatchEvent(new Event(GUEST_EVENT));
  },
};
export const guestStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(GUEST_KEY); } catch { return null; }
  },
  set(token: string) {
    try { window.localStorage.setItem(GUEST_KEY, token); } catch {}
    if (typeof window !== "undefined") window.dispatchEvent(new Event(GUEST_EVENT));
  },
  clear() {
    try { window.localStorage.removeItem(GUEST_KEY); } catch {}
    if (typeof window !== "undefined") window.dispatchEvent(new Event(GUEST_EVENT));
  },
};

/* ---------- 401 handling ---------- */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

type Options = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  token?: string | null;
  /** Skip the global 401 redirect (used by login forms). */
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

async function authorize(headers: Headers, requestToken?: string | null) {
  const token = requestToken ?? (await authTokenProvider?.()) ?? tokenStore.get();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    const guest = guestStore.get(); // signed out: a visitor identifies itself with its guest token
    if (guest) headers.set("Authorization", `Guest ${guest}`);
  }
}

function toApiError(res: Response, data: unknown, headers: Headers, skipAuthRedirect?: boolean): ApiError {
  if (res.status === 401 && headers.get("Authorization")?.startsWith("Guest ")) {
    guestStore.clear(); // the API does not know this visitor (database reset): GuestBootstrap asks for a new one
  } else if (res.status === 401 && !skipAuthRedirect) { tokenStore.clear(); onUnauthorized?.(); }
  const detail = data && typeof data === "object" ? (data as any).detail : undefined;
  const detailText = detail && typeof detail === "object" ? (detail.message ?? detail.code) : detail; // 402/429 send an object
  const msg =
    (data && typeof data === "object" && ("message" in data || "detail" in data)
      ? String((data as any).message ?? detailText)
      : null) ?? `Request failed (${res.status})`;
  return new ApiError(msg, res.status, data);
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

export async function apiFetch<T>(endpoint: string, options: Options = {}): Promise<T> {
  const { body, query, skipAuthRedirect, headers, token: requestToken, ...rest } = options;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const finalHeaders = new Headers(headers);
  finalHeaders.set("Accept", "application/json");
  if (body !== undefined && !isForm) finalHeaders.set("Content-Type", "application/json");
  await authorize(finalHeaders, requestToken);

  let res: Response;
  try {
    res = await fetch(buildUrl(endpoint, query), {
      ...rest,
      headers: finalHeaders,
      credentials: AUTH_MODE === "cookie" ? "include" : "omit",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const data = await readJson(res);
  if (!res.ok) throw toApiError(res, data, finalHeaders, skipAuthRedirect);
  return data as T;
}

/**
 * POST a form and read the answer as Server-Sent Events, calling `onEvent(name, data)` for each one as it arrives.
 * Errors before the stream starts (401, 402, 422...) come as JSON and are thrown as ApiError, like apiFetch.
 */
export async function apiStream(endpoint: string, form: FormData, onEvent: (name: string, data: any) => void): Promise<void> {
  const headers = new Headers({ Accept: "text/event-stream" });
  await authorize(headers);
  let res: Response;
  try {
    res = await fetch(buildUrl(endpoint), { method: "POST", headers, body: form, credentials: AUTH_MODE === "cookie" ? "include" : "omit" });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = await readJson(res);
    if (!res.ok) throw toApiError(res, data, headers);
    onEvent("done", data); // a server without streaming answered with plain JSON
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let cut: number;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      let name = "message";
      const lines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) name = line.slice(7);
        else if (line.startsWith("data: ")) lines.push(line.slice(6));
      }
      if (lines.length) onEvent(name, JSON.parse(lines.join("\n")));
    }
    if (done) return;
  }
}

export const api = {
  get: <T>(url: string, o?: Options) => apiFetch<T>(url, { ...o, method: "GET" }),
  post: <T>(url: string, body?: unknown, o?: Options) => apiFetch<T>(url, { ...o, method: "POST", body }),
  put: <T>(url: string, body?: unknown, o?: Options) => apiFetch<T>(url, { ...o, method: "PUT", body }),
  patch: <T>(url: string, body?: unknown, o?: Options) => apiFetch<T>(url, { ...o, method: "PATCH", body }),
  delete: <T>(url: string, o?: Options) => apiFetch<T>(url, { ...o, method: "DELETE" }),
};
