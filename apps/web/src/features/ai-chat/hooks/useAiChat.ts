"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSession, sendText, sendVoice } from "../api/ai";
import type { AiSession, StartSessionResponse, TurnResponse } from "../types/ai";
import { CREDITS_KEY } from "@/features/credits/hooks/useCredits";

const key = (id?: string) => ["ai-session", id] as const;

export const useAiSession = (id?: string) =>
  useQuery<AiSession>({ queryKey: key(id), enabled: false });

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
            { id: `${sessionId}-${prev.messages.length}`, role: "user", content: transcript, createdAt: new Date().toISOString() },
            { id: `${sessionId}-${prev.messages.length + 1}`, role: "assistant", content: r.reply, createdAt: new Date().toISOString() },
          ],
          corrections: [...prev.corrections, ...r.corrections],
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
