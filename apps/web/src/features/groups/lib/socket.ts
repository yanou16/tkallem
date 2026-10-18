/**
 * WS /ws/groups/{id}: what happens in the group, live. It only receives: sending always goes through REST.
 * Kept free of React so it is tested in socket.test.ts with a fake socket and fake timers.
 *
 * Protocol (apps/api/app/routes/group_ws.py): the first message is {"type": "auth", "token"} (never a token in the URL),
 * the server answers {"type": "auth.ok"}, then sends the group events. The client sends a ping every 25 s.
 */
import type { GroupEventDto } from "../types/groups";

export const PING_EVERY_MS = 25_000;
export const BACKOFF_FIRST_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;

/** Reconnecting cannot help: token refused (4401), not or no longer a member (4403), no such group (4404), origin refused (1008). */
export const FINAL_CLOSE_CODES: readonly number[] = [4401, 4403, 4404, 1008];
export const shouldReconnect = (code: number) => !FINAL_CLOSE_CODES.includes(code);

/** 1 s, 2 s, 4 s… up to 30 s, plus up to 20% at random so a whole group does not come back at the same instant. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** attempt);
  return Math.min(BACKOFF_MAX_MS, Math.round(base * (1 + 0.2 * random())));
}

/** A server message, or null when it is not JSON with a `type` (ignored). */
export function parseEvent(data: unknown): GroupEventDto | null {
  if (typeof data !== "string") return null;
  try {
    const event: unknown = JSON.parse(data);
    return event && typeof event === "object" && typeof (event as { type?: unknown }).type === "string"
      ? (event as GroupEventDto)
      : null;
  } catch {
    return null;
  }
}

export type SocketStatus =
  | { state: "connecting" }
  | { state: "live" }
  | { state: "reconnecting"; inMs: number }
  | { state: "closed"; code: number }; // final: one of FINAL_CLOSE_CODES

export type GroupSocketOptions = {
  url: string;
  /** A fresh Clerk session token at each (re)connection; null when signed out. */
  getToken: () => Promise<string | null>;
  onEvent: (event: GroupEventDto) => void;
  onStatus?: (status: SocketStatus) => void;
  /** Live again after a lost connection (not the first time): catch up on what was missed. */
  onReconnected?: () => void;
  createSocket?: (url: string) => WebSocket;
  random?: () => number;
};

const OPEN = 1; // WebSocket.OPEN

export function connectGroupSocket(o: GroupSocketOptions): { close: () => void } {
  const create = o.createSocket ?? ((url: string) => new WebSocket(url));
  let socket: WebSocket | null = null;
  let attempt = 0;
  let wasLive = false;
  let stopped = false;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  const status = (s: SocketStatus) => o.onStatus?.(s);
  const send = (ws: WebSocket, message: object) => {
    if (ws.readyState === OPEN) ws.send(JSON.stringify(message));
  };
  const stopPing = () => {
    if (ping !== undefined) clearInterval(ping);
    ping = undefined;
  };
  const scheduleRetry = () => {
    const inMs = backoffDelay(attempt++, o.random);
    status({ state: "reconnecting", inMs });
    retry = setTimeout(open, inMs);
  };

  async function open() {
    retry = undefined;
    if (stopped) return;
    status({ state: "connecting" });
    let token: string | null;
    try {
      token = await o.getToken();
    } catch {
      if (!stopped) scheduleRetry(); // Clerk unreachable for a moment
      return;
    }
    if (stopped) return;
    if (!token) {
      status({ state: "closed", code: 4401 });
      return;
    }

    const ws = create(o.url);
    socket = ws;
    ws.onopen = () => send(ws, { type: "auth", token });
    ws.onmessage = (e) => {
      const event = parseEvent(e.data);
      if (!event) return;
      if (event.type === "auth.ok") {
        attempt = 0;
        status({ state: "live" });
        stopPing();
        ping = setInterval(() => send(ws, { type: "ping" }), PING_EVERY_MS);
        if (wasLive) o.onReconnected?.();
        wasLive = true;
      } else if (event.type === "ping") {
        send(ws, { type: "pong" });
      } else if (event.type !== "pong") {
        o.onEvent(event);
      }
    };
    ws.onclose = (e) => {
      if (socket === ws) socket = null;
      stopPing();
      if (stopped) return;
      if (shouldReconnect(e.code)) scheduleRetry();
      else status({ state: "closed", code: e.code });
    };
  }

  void open();
  return {
    close() {
      stopped = true;
      if (retry !== undefined) clearTimeout(retry);
      stopPing();
      socket?.close(1000);
      socket = null;
    },
  };
}
