"use client";
import { useQuery } from "@tanstack/react-query";
import { getMeProgress, toDashboard, toTopMistakes } from "../api/dashboard";

// One request for both cards: same key as the progress screen, which reads the same endpoint.
export const useDashboard = () => useQuery({ queryKey: ["progress"], queryFn: getMeProgress, select: toDashboard });
export const useTopMistakes = () => useQuery({ queryKey: ["progress"], queryFn: getMeProgress, select: toTopMistakes });
