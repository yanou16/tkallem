/** How the student answers: a live call, a voice message, or text. Plain functions, tested in answerMode.test.ts. */
export type AnswerMode = "call" | "voice" | "text";

export const ANSWER_MODE_LABEL: Record<AnswerMode, string> = { call: "Call", voice: "Voice message", text: "Text" };

/** One line each, so a visitor who opens the app alone understands the difference between the three. */
export const ANSWER_MODE_HINT: Record<AnswerMode, string> = {
  call: "Talk with the coach hands-free, like a phone interview: it answers out loud as soon as you stop.",
  voice: "Record one answer, send it, then read and hear the coach's reply.",
  text: "Type your answers and read the replies.",
};

export const MODE_KEY = "tkallem.mode";

/** Voice message first (it is a speaking coach). The last choice is remembered, but never "call": it needs a tap and a microphone. */
export function readAnswerMode(storage: Pick<Storage, "getItem"> | null = safeStorage()): "voice" | "text" {
  try {
    return storage?.getItem(MODE_KEY) === "text" ? "text" : "voice";
  } catch {
    return "voice";
  }
}

export function rememberAnswerMode(mode: AnswerMode, storage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  if (mode === "call") return;
  try {
    storage?.setItem(MODE_KEY, mode);
  } catch {
    /* private mode */
  }
}

/** The modes on offer: the call only when the server has it switched on and the browser can do a live call. */
export function offeredModes(callAvailable: boolean): AnswerMode[] {
  return callAvailable ? ["call", "voice", "text"] : ["voice", "text"];
}

/** A live call needs WebRTC and a microphone API. */
export function browserCanCall(env: { RTCPeerConnection?: unknown; mediaDevices?: { getUserMedia?: unknown } } | null = browserEnv()): boolean {
  return !!env && typeof env.RTCPeerConnection === "function" && typeof env.mediaDevices?.getUserMedia === "function";
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function browserEnv() {
  if (typeof window === "undefined") return null;
  return { RTCPeerConnection: (window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection, mediaDevices: navigator.mediaDevices };
}
