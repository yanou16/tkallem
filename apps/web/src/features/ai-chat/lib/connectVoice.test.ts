import { afterEach, describe, expect, it, vi } from "vitest";
import { connectVoice } from "./connectVoice";
import { ApiError, setAuthTokenProvider } from "@/lib/api/client";

afterEach(() => {
  setAuthTokenProvider(null);
  vi.unstubAllGlobals();
});

describe("voice signaling authentication", () => {
  it("waits for microphone permission before requesting a fresh token", async () => {
    let token = "expired-before-permission";
    const getToken = vi.fn(async () => token);
    setAuthTokenProvider(getToken);
    const client = {
      initDevices: vi.fn(async () => { expect(getToken).not.toHaveBeenCalled(); token = "fresh-after-permission"; }),
      connect: vi.fn(async (params) => params),
    };
    await connectVoice(client, "session-1");
    expect(getToken).toHaveBeenCalledWith({ skipCache: true });
    const request = client.connect.mock.calls[0][0].webrtcRequestParams;
    expect(request.endpoint).toMatch(/\/sessions\/session-1\/webrtc$/);
    expect(request.headers.get("Authorization")).toBe("Bearer fresh-after-permission");
  });

  it("preserves guest authentication", async () => {
    vi.stubGlobal("window", { localStorage: { getItem: () => "guest-token" } });
    const client = { initDevices: vi.fn(async () => {}), connect: vi.fn(async (params) => params) };
    await connectVoice(client, "guest-session");
    expect(client.connect.mock.calls[0][0].webrtcRequestParams.headers.get("Authorization")).toBe("Guest guest-token");
  });

  it("does not send an unauthenticated offer", async () => {
    const client = { initDevices: vi.fn(async () => {}), connect: vi.fn() };
    await expect(connectVoice(client, "session")).rejects.toMatchObject({ status: 401 });
    expect(client.connect).not.toHaveBeenCalled();
  });

  it("does not fetch a token or send an offer when microphone setup fails", async () => {
    const getToken = vi.fn();
    setAuthTokenProvider(getToken);
    const client = { initDevices: vi.fn(async () => { throw new Error("Permission denied"); }), connect: vi.fn() };
    await expect(connectVoice(client, "session")).rejects.toThrow("Permission denied");
    expect(getToken).not.toHaveBeenCalled();
    expect(client.connect).not.toHaveBeenCalled();
  });

  it("turns an offer's 401 into an actionable login error", async () => {
    setAuthTokenProvider(async () => "token");
    const client = { initDevices: vi.fn(async () => {}), connect: vi.fn(async () => { throw { status: 401 }; }) };
    await expect(connectVoice(client, "session")).rejects.toBeInstanceOf(ApiError);
    await expect(connectVoice(client, "session")).rejects.toThrow("voice server rejected your login");
  });
});
