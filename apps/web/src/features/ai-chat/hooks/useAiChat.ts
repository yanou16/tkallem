"use client";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { askHint, endSession, repeatAnswer, getSession, sendAnswer, speakLastLine, startSession, streamAnswer, type AnswerInput, type LiveTurn } from "../api/ai";
import { CREDITS_KEY } from "@/features/credits/hooks/useCredits";
import { MY_SESSIONS_KEY } from "@/features/practice/hooks/usePractice";
import { ACHIEVEMENTS_KEY } from "@/features/profile/hooks/useProfile";
import type { AiSession, HintRequestDto, Turn } from "../types/ai";

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
      { id: `${session.id}-${n + 1}`, role: "assistant", content: turn.reply, createdAt: at, audioUrl: turn.audioUrl },
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
    mutationFn: ({ scenarioId, mode }: { scenarioId: string; mode: "text" | "voice" }) => startSession(scenarioId, mode),
    onSuccess: (s, { scenarioId }) => {
      qc.setQueryData<AiSession>(key(s.sessionId), {
        id: s.sessionId,
        scenarioId,
        finished: false,
        messages: [{ id: `${s.sessionId}-0`, role: "assistant", content: s.firstQuestion, createdAt: new Date().toISOString(), audioUrl: s.firstQuestionAudio }],
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

/**
 * One answer, typed or spoken, streamed: `live` holds the transcript, the coach's text and the corrections as soon as
 * the server has them, `onAudio` plays the coach's voice at once; the turn joins the conversation once it is saved.
 */
export function useAnswer(sessionId: string | undefined, onAudio: (url: string | null, reply: string) => void) {
  const qc = useQueryClient();
  const [live, setLive] = useState<LiveTurn | null>(null);
  const audio = useRef(onAudio);
  audio.current = onAudio;
  const mutation = useMutation({
    mutationFn: (input: AnswerInput) => {
      setLive({});
      return streamAnswer(sessionId!, input, (u) => setLive((l) => ({ ...l, ...u })), (url, reply) => audio.current(url, reply));
    },
    onSuccess: (turn) => {
      if (!sessionId) return;
      if (turn.credits) qc.setQueryData(CREDITS_KEY, turn.credits); // the header counter follows every answer
      qc.setQueryData<AiSession>(key(sessionId), (prev) => prev && addTurn(prev, turn));
      qc.invalidateQueries({ queryKey: MY_SESSIONS_KEY });
    },
    onSettled: () => setLive(null),
  });
  return { ...mutation, live };
}

/** The coach says its last line aloud (first question of a voice session, or switching to voice mid-session); the
 * session becomes a voice session. `id` overrides the hook's session (a session just created, URL not updated yet). */
export const useSpeakLastLine = (sessionId?: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id?: string) => speakLastLine((id ?? sessionId)!),
    onSuccess: (r, id) =>
      qc.setQueryData<AiSession>(key(id ?? sessionId), (prev) => {
        if (!prev) return prev;
        const messages = [...prev.messages];
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === "assistant") { messages[i] = { ...messages[i], audioUrl: r.audio_url }; break; }
        }
        return { ...prev, messages };
      }),
  });
};

/** "Help me start" on the current question: free, at most 2 per question (the API answers 429 after that). */
export const useHint = (sessionId?: string) =>
  useMutation({ mutationFn: (body: HintRequestDto) => askHint(sessionId!, body) });

/** "Say it again" on one corrected answer: free, 3 tries per answer (the API answers 429 after that). */
export const useRepeat = (sessionId?: string) =>
  useMutation({ mutationFn: ({ turn, audio }: { turn: number; audio: Blob }) => repeatAnswer(sessionId!, turn, audio) });
