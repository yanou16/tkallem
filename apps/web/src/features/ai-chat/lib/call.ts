import type { AiSession, ChatMessage, Correction, SentenceStatus } from "../types/ai";

/** What the call tells the page, kept as pure functions on the session so they are tested without a browser. */
export type CallTurn = {
  utterance_id?: string;
  original: string;
  reply: string;
  sentence_status: SentenceStatus;
  corrections: Correction[];
};

const HEARD = "call-heard-";
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** The student's words as the call hears them, before the answer has been checked. Only the latest one is kept. */
export function addHeard(session: AiSession, text: string, at = new Date().toISOString()): AiSession {
  const kept = session.messages.filter((m) => !m.id.startsWith(HEARD));
  const message: ChatMessage = { id: `${HEARD}${kept.length}`, role: "user", content: text, createdAt: at };
  return { ...session, messages: [...kept, message] };
}

/** A line the coach says. The greeting repeats the first question already on screen, and a reply can arrive twice: no duplicates. */
export function addCoachLine(session: AiSession, text: string, at = new Date().toISOString()): AiSession {
  const last = [...session.messages].reverse().find((m) => m.role === "assistant");
  if (last && normalize(last.content) === normalize(text)) return session;
  const message: ChatMessage = { id: `call-coach-${session.messages.length}`, role: "assistant", content: text, createdAt: at };
  return { ...session, messages: [...session.messages, message] };
}

/**
 * The checked answer replaces what was heard (and the coach line streamed after it): the student's answer with its
 * corrections, then the coach's reply, as a typed turn would show. In a real interview nothing is shown before the report.
 */
export function applyCallTurn(session: AiSession, turn: CallTurn, hideFeedback: boolean, at = new Date().toISOString()): AiSession {
  const id = turn.utterance_id ? `call-${turn.utterance_id}` : `call-turn-${session.messages.length}`;
  if (session.messages.some((m) => m.id === id)) return session; // delivered twice
  const heard = session.messages.findIndex((m) => m.id.startsWith(HEARD));
  const before = heard >= 0 ? session.messages.slice(0, heard) : session.messages;
  const answer: ChatMessage = {
    id,
    role: "user",
    content: turn.original,
    createdAt: at,
    status: hideFeedback ? null : turn.sentence_status,
    corrections: hideFeedback ? [] : turn.corrections,
    praise: null,
  };
  const reply: ChatMessage = { id: `${id}-reply`, role: "assistant", content: turn.reply, createdAt: at };
  return { ...session, messages: [...before, answer, reply] };
}

export type CallError = { kind: "mic-denied" | "timeout" | "no-credits" | "unavailable" | "other"; message: string };

/** What went wrong, in words the student can act on. Every case ends with the voice message as the way out. */
export function callError(error: unknown, code?: string): CallError {
  const name = error instanceof Error ? error.name : "";
  const text = error instanceof Error ? error.message : String(error ?? "");
  if (code === "no_credits" || code === "daily_budget_reached") {
    return { kind: "no-credits", message: code === "no_credits" ? "You have no answers left. Create a free account to get more." : "Today's free practice is used up. Come back tomorrow." };
  }
  if (name === "NotAllowedError" || name === "SecurityError" || /permission|not allowed|denied/i.test(text)) {
    return { kind: "mic-denied", message: "The microphone is blocked. Allow it for this site, or answer with a voice message." };
  }
  if (name === "NotFoundError" || /no .*(microphone|device)|requested device not found/i.test(text)) {
    return { kind: "mic-denied", message: "No microphone was found. Plug one in, or answer by text." };
  }
  if (/switched off|503|call_disabled/i.test(text)) {
    return { kind: "unavailable", message: "The live call is not available right now. Use a voice message instead." };
  }
  if (name === "CallTimeout") {
    return { kind: "timeout", message: "The call could not connect on this network. Use a voice message instead: it works everywhere." };
  }
  return { kind: "other", message: "The call stopped. You can try again, or use a voice message." };
}

export const CALL_CONNECT_TIMEOUT_MS = 12_000;
