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
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as { message?: unknown; code?: unknown }; // 402 no_credits, 429 daily_budget_reached
    if (typeof d.message === "string") return d.message;
    if (typeof d.code === "string") return d.code;
  }
  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    if (first && typeof first === "object" && typeof (first as { msg?: unknown }).msg === "string") {
      return (first as { msg: string }).msg;
    }
  }
  return `Request failed (${status})`;
}

/** Signed in: the Clerk session token. Signed out: the guest token, if this visitor has one. */
async function authorize(headers: Headers, requestToken?: string | null) {
  const token = requestToken ?? (await authTokenProvider?.()) ?? null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    return;
  }
  const guest = guestStore.get();
  if (guest) headers.set("Authorization", `Guest ${guest}`);
}

function failure(res: Response, data: unknown, headers: Headers, skipAuthRedirect?: boolean): ApiError {
  if (res.status === 401 && headers.get("Authorization")?.startsWith("Guest ")) {
    guestStore.clear(); // the API does not know this visitor (database reset): GuestBootstrap asks for a new one
  } else if (res.status === 401 && !skipAuthRedirect) {
    onUnauthorized?.();
  }
  return new ApiError(errorMessage(data, res.status), res.status, data);
}

async function readBody(res: Response): Promise<unknown> {
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
      credentials: "omit",
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const data = await readBody(res);
  if (!res.ok) throw failure(res, data, finalHeaders, skipAuthRedirect);
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
    res = await fetch(buildUrl(endpoint), { method: "POST", headers, body: form, credentials: "omit" });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (!res.ok || !res.body || !(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = await readBody(res);
    if (!res.ok) throw failure(res, data, headers);
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
