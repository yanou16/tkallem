"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createSession, getSession, saveCorrection, sendMessage, sendVoice } from "../api/ai";
import type { AiSession, SendMessageResponse } from "../types/ai";

const key = (id?: string) => ["ai-session", id] as const;

export const useAiSession = (id?: string) =>
  useQuery({ queryKey: key(id), queryFn: () => getSession(id!), enabled: !!id });

export const useCreateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSession,
    onSuccess: (s) => qc.setQueryData(key(s.id), s),
  });
};

function merge(qc: ReturnType<typeof useQueryClient>, sessionId: string, r: SendMessageResponse) {
  qc.setQueryData<AiSession>(key(sessionId), (prev) =>
    prev
      ? {
          ...prev,
          messages: [...prev.messages, ...(r.userMessage ? [r.userMessage] : []), r.message],
          corrections: [...prev.corrections, ...(r.corrections ?? [])],
          vocabulary: [...prev.vocabulary, ...(r.newVocabulary ?? [])],
        }
      : prev,
  );
}

export const useSendMessage = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (r) => sessionId && merge(qc, sessionId, r),
  });
};

export const useSendVoice = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (audio: Blob) => sendVoice(sessionId!, audio),
    onSuccess: (r) => sessionId && merge(qc, sessionId, r),
  });
};

export const useSaveCorrection = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (correctionId: string) => saveCorrection(sessionId!, correctionId),
    onSuccess: (_r, correctionId) =>
      qc.setQueryData<AiSession>(key(sessionId), (prev) =>
        prev
          ? {
              ...prev,
              savedMistakesCount: prev.savedMistakesCount + 1,
              corrections: prev.corrections.map((c) => (c.id === correctionId ? { ...c, saved: true } : c)),
            }
          : prev,
      ),
  });
};
