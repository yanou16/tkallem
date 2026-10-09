import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { AiSession, SendMessageInput, SendMessageResponse } from "../types/ai";

export const createSession = (input: { scenarioId?: string; mode: "text" | "voice"; level?: string }) =>
  api.post<AiSession>(endpoints.ai.sessions, input);
export const getSession = (id: string) => api.get<AiSession>(endpoints.ai.session(id));
export const sendMessage = ({ sessionId, ...body }: SendMessageInput) =>
  api.post<SendMessageResponse>(endpoints.ai.messages(sessionId), body);
export const sendVoice = (sessionId: string, audio: Blob) => {
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  return api.post<SendMessageResponse>(endpoints.ai.voice(sessionId), form);
};
export const saveCorrection = (sessionId: string, correctionId: string) =>
  api.post<{ saved: boolean }>(endpoints.ai.saveCorrection(sessionId, correctionId));
export const assistWriting = (text: string, context?: string) =>
  api.post<{ suggestion: string }>(endpoints.ai.assist, { text, context });
