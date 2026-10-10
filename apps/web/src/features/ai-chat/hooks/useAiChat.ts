"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endSession, getSession, sendAnswer, startSession } from "../api/ai";
import { MY_SESSIONS_KEY } from "@/features/practice/hooks/usePractice";
import { ACHIEVEMENTS_KEY } from "@/features/profile/hooks/useProfile";
import type { AiSession, Turn } from "../types/ai";

const key = (id?: string) => ["ai-session", id] as const;

/** Adds one turn: the student's answer (with its status and corrections), then the coach reply. */
export function addTurn(session: AiSession, turn: Turn, at = new Date().toISOString()): AiSession {
  const n = session.messages.length;
  return {
    ...session,
    finished: turn.finished,
    messages: [
      ...session.messages,
      { id: `${session.id}-${n}`, role: "user", content: turn.transcript, createdAt: at, status: turn.sentenceStatus, corrections: turn.corrections },
      { id: `${session.id}-${n + 1}`, role: "assistant", content: turn.reply, createdAt: at },
    ],
  };
}

/** A session started here is already in the cache (kept up to date by the mutations below); after a page refresh
 * or a "Continue" link, it is loaded once with GET /sessions/{id}. */
export const useAiSession = (id?: string) =>
  useQuery<AiSession>({ queryKey: key(id), queryFn: () => getSession(id!), enabled: !!id, staleTime: Infinity });

export const useStartSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startSession,
    onSuccess: (s, scenarioId) => {
      qc.setQueryData<AiSession>(key(s.sessionId), {
        id: s.sessionId,
        scenarioId,
        finished: false,
        messages: [{ id: `${s.sessionId}-0`, role: "assistant", content: s.firstQuestion, createdAt: new Date().toISOString() }],
      });
      qc.invalidateQueries({ queryKey: MY_SESSIONS_KEY });
    },
  });
};

export const useSendAnswer = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => sendAnswer(sessionId!, text),
    onSuccess: (turn) => {
      if (!sessionId) return;
      qc.setQueryData<AiSession>(key(sessionId), (prev) => prev && addTurn(prev, turn));
      qc.invalidateQueries({ queryKey: MY_SESSIONS_KEY });
    },
  });
};

export const useEndSession = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => endSession(sessionId!),
    onSuccess: (report) => {
      if (sessionId) qc.setQueryData<AiSession>(key(sessionId), (prev) => prev && { ...prev, report });
      qc.invalidateQueries({ queryKey: MY_SESSIONS_KEY });
      qc.invalidateQueries({ queryKey: ["progress"] });
      // A finished session can unlock badges.
      qc.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    },
  });
};
