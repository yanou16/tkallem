import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { Spoken, AiSession, SessionDetail, SessionReport, StartSessionInput, StartSessionResponse, TurnResponse } from "../types/ai";

export const createSession = (input: StartSessionInput) =>
  api.post<StartSessionResponse>(endpoints.ai.sessions, input);

export const sendText = (sessionId: string, text: string) => {
  const form = new FormData();
  form.append("text", text);
  return api.post<TurnResponse>(endpoints.ai.turn(sessionId), form);
};

export const sendVoice = (sessionId: string, audio: Blob) => {
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  return api.post<TurnResponse>(endpoints.ai.turn(sessionId), form);
};

/** Reload a conversation (page refresh, "Continue" from Practice). */
export async function getSession(sessionId: string): Promise<AiSession> {
  const d = await api.get<SessionDetail>(endpoints.ai.session(sessionId));
  return {
    id: d.session_id,
    scenarioId: d.scenario_id,
    scenarioTitle: d.title,
    messages: d.lines.map((l, i) => ({
      id: `${d.session_id}-${i}`,
      role: l.role === "student" ? "user" : "assistant",
      content: l.text,
      status: l.status ?? undefined,
    })),
    corrections: d.lines.flatMap((l) => l.corrections ?? []),
    finished: d.finished,
    ended: d.ended,
  };
}

export const endSession = (sessionId: string) => api.post<SessionReport>(endpoints.ai.end(sessionId));

/** Switch to voice mid-session: the coach says its last line again and the next replies are spoken. */
export const speakLastLine = (sessionId: string) => api.post<Spoken>(endpoints.ai.speak(sessionId));
