"use client";
import { useQuery } from "@tanstack/react-query";
import { getFocus, getRecentSessions, getScenarios } from "../api/practice";

export const useScenarios = () => useQuery({ queryKey: ["scenarios"], queryFn: getScenarios, staleTime: Infinity });
export const useRecentSessions = () => useQuery({ queryKey: ["practice-recent"], queryFn: getRecentSessions });
export const usePracticeFocus = () => useQuery({ queryKey: ["practice-focus"], queryFn: getFocus });
