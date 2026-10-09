import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { StartSessionInput, StartSessionResponse, TurnResponse } from "../types/ai";

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
