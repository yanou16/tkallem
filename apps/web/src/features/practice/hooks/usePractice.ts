"use client";
import { useQuery } from "@tanstack/react-query";
import { getFocus, getRecentSessions, getRecommended, getScenarios } from "../api/practice";

export const useScenarios = (category?: string) =>
  useQuery({ queryKey: ["practice-scenarios", category ?? "all"], queryFn: () => getScenarios(category) });
export const useRecentSessions = () => useQuery({ queryKey: ["practice-recent"], queryFn: getRecentSessions });
export const useRecommended = () => useQuery({ queryKey: ["practice-recommended"], queryFn: getRecommended });
export const usePracticeFocus = () => useQuery({ queryKey: ["practice-focus"], queryFn: getFocus });
