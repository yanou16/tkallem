"use client";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSession, endSession, getSession, sendText, sendVoice, speakLastLine } from "../api/ai";
import type { AiSession, SessionReport, StartSessionResponse, TurnResponse } from "../types/ai";
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

export const useSendMessage = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ text }: { text: string }) => sendText(sessionId!, text),
    onSuccess: (r, variables) => sessionId && merge(qc, sessionId, variables.text, r),
  });
};

export const useSendVoice = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (audio: Blob) => sendVoice(sessionId!, audio),
    onSuccess: (r) => sessionId && merge(qc, sessionId, r.transcript, r),
  });
};

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
