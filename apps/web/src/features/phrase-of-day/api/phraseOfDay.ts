import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PhraseChecked, PhraseOfDay } from "../types/phraseOfDay";

export const getPhraseOfDay = () => api.get<PhraseOfDay>(endpoints.phraseOfDay);

/** The student says today's phrase. Only the recording is sent: the server knows which phrase it is. */
export const checkPhraseOfDay = (audio: Blob) => {
  const form = new FormData();
  form.append("audio", audio, audio.type.includes("mp4") ? "phrase.mp4" : "phrase.webm");
  return api.post<PhraseChecked>(endpoints.phraseOfDayCheck, form);
};
