import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKOFF_MAX_MS, PING_EVERY_MS, backoffDelay, connectGroupSocket, parseEvent, shouldReconnect, type SocketStatus } from "./socket";

/** What connectGroupSocket uses of a browser WebSocket, plus what the tests do on the server side. */
class FakeSocket {
  readyState = 0;
  sent: unknown[] = [];
  closedWith?: number;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  constructor(public url: string) {}
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close(code = 1000) { this.closedWith = code; }
  open() { this.readyState = 1; this.onopen?.(); }
  receive(event: object) { this.onmessage?.({ data: JSON.stringify(event) }); }
  drop(code: number) { this.readyState = 3; this.onclose?.({ code }); }
}

let sockets: FakeSocket[];
let statuses: SocketStatus[];

function connect(overrides: Partial<Parameters<typeof connectGroupSocket>[0]> = {}) {
  const onEvent = vi.fn();
  const onReconnected = vi.fn();
  const connection = connectGroupSocket({
    url: "ws://localhost:8000/ws/groups/7",
    getToken: async () => "clerk-token",
    onEvent,
    onReconnected,
    onStatus: (s) => statuses.push(s),
    createSocket: (url) => { const s = new FakeSocket(url); sockets.push(s); return s as unknown as WebSocket; },
    random: () => 0, // no jitter: exact delays
    ...overrides,
  });
  return { connection, onEvent, onReconnected };
}

/** Lets the token promise resolve, then runs the timers due. */
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);
const last = () => sockets[sockets.length - 1];
async function live() {
  await tick();
  last().open();
  last().receive({ type: "auth.ok" });
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  statuses = [];
});
afterEach(() => vi.useRealTimers());

describe("connectGroupSocket", () => {
  it("sends the token as the first message, never in the URL", async () => {
    connect();
    await tick();
    last().open();

    expect(last().url).toBe("ws://localhost:8000/ws/groups/7");
    expect(last().sent).toEqual([{ type: "auth", token: "clerk-token" }]);
  });

  it("is live after auth.ok and pings every 25 s", async () => {
    connect();
    await live();
    expect(statuses[statuses.length - 1]).toEqual({ state: "live" });

    await tick(PING_EVERY_MS);
    await tick(PING_EVERY_MS);
    expect(last().sent.slice(1)).toEqual([{ type: "ping" }, { type: "ping" }]);
  });

  it("answers a ping from the server with a pong", async () => {
    connect();
    await live();
    last().receive({ type: "ping" });
    expect(last().sent).toContainEqual({ type: "pong" });
  });

  it("passes the group events on, not the protocol ones", async () => {
    const { onEvent } = connect();
    await live();
    last().receive({ type: "pong" });
    last().receive({ type: "message.hidden", message_id: 12 });
    last().onmessage?.({ data: "not json" });

    expect(onEvent.mock.calls).toEqual([[{ type: "message.hidden", message_id: 12 }]]);
  });

  it("reconnects with backoff after a lost connection, then asks to catch up", async () => {
    const { onReconnected } = connect();
    await live();
    expect(onReconnected).not.toHaveBeenCalled(); // the first connection has nothing to catch up

    last().drop(1006);
    expect(statuses[statuses.length - 1]).toEqual({ state: "reconnecting", inMs: 1000 });
    await tick(999);
    expect(sockets).toHaveLength(1);
    await tick(1);
    expect(sockets).toHaveLength(2);

    await live();
    expect(onReconnected).toHaveBeenCalledTimes(1);
  });

  it("waits longer at each failed attempt, and starts again from 1 s after a success", async () => {
    connect();
    await tick();
    const delays: number[] = [];
    for (let i = 0; i < 3; i++) {
      last().drop(1006); // the server is still down
      delays.push((statuses[statuses.length - 1] as { inMs: number }).inMs);
      await tick(delays[i]);
    }
    expect(delays).toEqual([1000, 2000, 4000]);

    await live();
    last().drop(1006);
    expect(statuses[statuses.length - 1]).toEqual({ state: "reconnecting", inMs: 1000 });
  });

  it.each([4401, 4403, 4404, 1008])("does not reconnect after close code %i", async (code) => {
    connect();
    await live();
    last().drop(code);
    await tick(BACKOFF_MAX_MS * 2);

    expect(sockets).toHaveLength(1);
    expect(statuses[statuses.length - 1]).toEqual({ state: "closed", code });
  });

  it("close() closes the socket and stops pings and reconnections", async () => {
    const { connection } = connect();
    await live();
    connection.close();
    expect(last().closedWith).toBe(1000);

    last().drop(1000);
    await tick(BACKOFF_MAX_MS * 2);
    expect(sockets).toHaveLength(1);
    expect(last().sent).toEqual([{ type: "auth", token: "clerk-token" }]);
  });

  it("signed out (no token): no socket is opened", async () => {
    connect({ getToken: async () => null });
    await tick();
    expect(sockets).toHaveLength(0);
    expect(statuses[statuses.length - 1]).toEqual({ state: "closed", code: 4401 });
  });

  it("retries later when the token cannot be fetched", async () => {
    let calls = 0;
    connect({ getToken: async () => { if (calls++ === 0) throw new Error("offline"); return "clerk-token"; } });
    await tick();
    expect(sockets).toHaveLength(0);
    await tick(1000);
    expect(sockets).toHaveLength(1);
  });
});

describe("backoffDelay", () => {
  it("doubles from 1 s and stays at 30 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map((a) => backoffDelay(a, () => 0))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });

  it("adds at most 20% at random, never above 30 s", () => {
    expect(backoffDelay(0, () => 0.999)).toBeLessThanOrEqual(1200);
    expect(backoffDelay(0, () => 0.999)).toBeGreaterThan(1000);
    expect(backoffDelay(10, () => 0.999)).toBe(BACKOFF_MAX_MS);
  });
});

describe("shouldReconnect", () => {
  it("reconnects after a lost connection or a server error, not after a refusal", () => {
    expect([1000, 1006, 1011, 1012].every(shouldReconnect)).toBe(true);
    expect([4401, 4403, 4404, 1008].some(shouldReconnect)).toBe(false);
  });
});

describe("parseEvent", () => {
  it("reads a JSON event with a type, and ignores anything else", () => {
    expect(parseEvent('{"type":"auth.ok"}')).toEqual({ type: "auth.ok" });
    expect(parseEvent("not json")).toBeNull();
    expect(parseEvent('{"no":"type"}')).toBeNull();
    expect(parseEvent("null")).toBeNull();
    expect(parseEvent(new ArrayBuffer(2))).toBeNull();
  });
});
