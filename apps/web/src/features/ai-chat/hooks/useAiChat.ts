"use client";
import { useRef, useState } from "react";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiStream } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { createSession, endSession, getSession, speakLastLine } from "../api/ai";
import type { AiSession, Correction, SentenceStatus, SessionReport, StartSessionResponse, TurnResponse } from "../types/ai";
import { CREDITS_KEY } from "@/features/credits/hooks/useCredits";

const key = (id?: string) => ["ai-session", id] as const;

// The cache is filled by the start and turn mutations; the server is read only when the page opens on an existing
// session (refresh, "Continue"). staleTime Infinity: never refetch over answers merged locally.
export const useAiSession = (id?: string) =>
  useQuery<AiSession>({ queryKey: key(id), queryFn: () => getSession(id!), enabled: !!id, staleTime: Infinity, retry: false });

const reportKey = (id?: string) => ["ai-report", id] as const;
export const useSessionReport = (id?: string) =>
  useQuery<SessionReport>({ queryKey: reportKey(id), queryFn: skipToken }); // filled by useEndSession only, never fetched

export const useEndSession = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => endSession(sessionId!),
    onSuccess: (report) => {
      qc.setQueryData(reportKey(sessionId), report);
      qc.setQueryData<AiSession>(key(sessionId), (prev) => (prev ? { ...prev, ended: true } : prev));
      qc.invalidateQueries({ queryKey: ["progress"] }); // the report adds this session to the progress numbers
    },
  });
};

export const useCreateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSession,
    onSuccess: (s: StartSessionResponse) => {
      qc.setQueryData<AiSession>(key(s.session_id), {
        id: s.session_id,
        messages: [{
          id: `${s.session_id}-question`,
          role: "assistant",
          content: s.first_question.text,
          createdAt: new Date().toISOString(),
          audioUrl: s.first_question.audio_url,
        }],
        corrections: [],
      });
    },
  });
};

function merge(qc: ReturnType<typeof useQueryClient>, sessionId: string, transcript: string, r: TurnResponse) {
  if (r.credits) qc.setQueryData(CREDITS_KEY, r.credits); // the header counter follows every answer
  qc.setQueryData<AiSession>(key(sessionId), (prev) =>
    prev
      ? {
          ...prev,
          messages: [
            ...prev.messages,
            { id: `${sessionId}-${prev.messages.length}`, role: "user", content: transcript, createdAt: new Date().toISOString(), status: r.sentence_status },
            { id: `${sessionId}-${prev.messages.length + 1}`, role: "assistant", content: r.reply, createdAt: new Date().toISOString(), audioUrl: r.reply_audio_url },
          ],
          corrections: [...prev.corrections, ...r.corrections],
          finished: r.finished ?? prev.finished,
        }
      : prev,
  );
}

export const useSpeakLastLine = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => speakLastLine(sessionId!),
    onSuccess: (r) =>
      qc.setQueryData<AiSession>(key(sessionId), (prev) => {
        if (!prev) return prev;
        const messages = [...prev.messages];
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant") { messages[i] = { ...messages[i], audioUrl: r.audio_url }; break; }
        }
        return { ...prev, messages };
      }),
  });
};

/** What is already known about the answer being processed (streamed): shown before the turn is saved. */
export type LiveTurn = { transcript?: string; reply?: string; corrections?: Correction[]; status?: SentenceStatus };
export type TurnInput = { text: string } | { audio: Blob };

/**
 * One answer, typed or spoken, read as a stream: the transcript, the coach's text and its voice arrive as soon as the
 * server has them (`live`, `onAudio`), the corrections next; the turn joins the conversation once it is saved.
 */
export function useTurn(sessionId: string | undefined, onAudio: (url: string | null, text: string) => void) {
  const qc = useQueryClient();
  const [live, setLive] = useState<LiveTurn | null>(null);
  const audioHandler = useRef(onAudio);
  audioHandler.current = onAudio;

  const mutation = useMutation({
    mutationFn: async (input: TurnInput): Promise<TurnResponse> => {
      const form = new FormData();
      if ("text" in input) form.append("text", input.text);
      else form.append("audio", input.audio, "recording.webm");
      setLive({});
      let reply = "";
      let audioUrl: string | null = null;
      let final: TurnResponse | null = null;
      let failure: ApiError | null = null;
      await apiStream(endpoints.ai.turn(sessionId!), form, (name, data) => {
        if (name === "transcript") setLive((l) => ({ ...l, transcript: data.text }));
        else if (name === "reply") { reply = data.text; setLive((l) => ({ ...l, reply })); }
        else if (name === "corrections") setLive((l) => ({ ...l, corrections: data.corrections, status: data.sentence_status }));
        else if (name === "audio") { audioUrl = data.audio_url; audioHandler.current(audioUrl, reply); }
        else if (name === "done") final = { ...data, reply_audio_url: audioUrl ?? data.reply_audio_url ?? null };
        else if (name === "error") failure = new ApiError(data.detail, data.status, data);
      });
      if (failure) throw failure;
      if (!final) throw new ApiError("The answer was interrupted. Send it again.", 0);
      return final;
    },
    onSuccess: (r) => { if (sessionId) merge(qc, sessionId, r.transcript, r); },
    onSettled: () => setLive(null),
  });
  return { ...mutation, live };
}
