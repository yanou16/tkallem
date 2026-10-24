import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiStream, errorMessage, setAuthTokenProvider, setUnauthorizedHandler } from "./client";

function serverReplies(status: number, body?: unknown) {
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentHeaders(fetchMock: ReturnType<typeof serverReplies>, call = 0) {
  return new Headers(fetchMock.mock.calls[call][1].headers);
}

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthTokenProvider(null);
  setUnauthorizedHandler(null);
});

describe("errorMessage", () => {
  it("reads the detail of an HTTPException", () => {
    expect(errorMessage({ detail: "Session already ended" }, 409)).toBe("Session already ended");
  });

  it("reads the first issue of a validation error", () => {
    const detail = [{ type: "literal_error", loc: ["body", "level"], msg: "Input should be 'A2', 'B1', 'B2' or 'C1'" }];
    expect(errorMessage({ detail }, 422)).toBe("Input should be 'A2', 'B1', 'B2' or 'C1'");
  });

  it("falls back to the status when there is no detail", () => {
    expect(errorMessage("Internal Server Error", 500)).toBe("Request failed (500)");
    expect(errorMessage({ detail: [] }, 422)).toBe("Request failed (422)");
  });
});

describe("api", () => {
  it("sends the Clerk session token as a Bearer token", async () => {
    const fetchMock = serverReplies(200, { level: "B1" });
    setAuthTokenProvider(async () => "clerk-jwt");

    await expect(api.get("/me")).resolves.toEqual({ level: "B1" });
    expect(sentHeaders(fetchMock).get("Authorization")).toBe("Bearer clerk-jwt");
  });

  it("sends no Authorization header without a token", async () => {
    const fetchMock = serverReplies(200, {});

    await api.get("/me");

    expect(sentHeaders(fetchMock).has("Authorization")).toBe(false);
  });

  it("sends JSON bodies as JSON and form data as multipart", async () => {
    const fetchMock = serverReplies(200, {});
    await api.patch("/me", { level: "B2" });
    expect(sentHeaders(fetchMock).get("Content-Type")).toBe("application/json");
    expect(fetchMock.mock.calls[0][1].body).toBe('{"level":"B2"}');

    const form = new FormData();
    form.append("text", "Hello");
    await api.post("/sessions/abc/turn", form);
    expect(sentHeaders(fetchMock, 1).has("Content-Type")).toBe(false);
    expect(fetchMock.mock.calls[1][1].body).toBe(form);
  });

  it("throws an ApiError with the status and the FastAPI detail", async () => {
    serverReplies(502, { detail: "The coach is unavailable, send your answer again" });

    const error = await api.post("/sessions/abc/turn", new FormData()).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, message: "The coach is unavailable, send your answer again" });
  });

  it("calls the unauthorized handler on 401", async () => {
    serverReplies(401, { detail: "Missing bearer token" });
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(api.get("/me")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("reports an unreachable server as status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(api.get("/me")).rejects.toMatchObject({ status: 0 });
  });
});


describe("stream completion", () => {
  it.each(["\n", "\r\n"])("finishes at a persisted done event with %j line endings", async (newline) => {
    const encoder = new TextEncoder();
    const cancel = vi.fn();
    const wire = `event: reply${newline}data: {"text":"Hi"}${newline}${newline}event: done${newline}data: {"saved":true}${newline}${newline}`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        // Deliberately split CRLF pairs and keep the connection open after done.
        for (const character of wire) controller.enqueue(encoder.encode(character));
      }, cancel,
    }), { headers: { "content-type": "text/event-stream" } })));
    const events: unknown[] = [];
    await apiStream("/sessions/test/turn", new FormData(), (name, data) => events.push([name, data]));
    expect(events).toEqual([["reply", { text: "Hi" }], ["done", { saved: true }]]);
    expect(cancel).toHaveBeenCalledOnce();
  });
});
