"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { checkPhraseOfDay, getPhraseOfDay } from "../api/phraseOfDay";

/** Same phrase all day: no need to ask again before the page is reloaded. */
export const usePhraseOfDay = () => useQuery({ queryKey: ["phrase-of-the-day"], queryFn: getPhraseOfDay, staleTime: 60 * 60 * 1000 });
export const useCheckPhrase = () => useMutation({ mutationFn: (audio: Blob) => checkPhraseOfDay(audio) });
