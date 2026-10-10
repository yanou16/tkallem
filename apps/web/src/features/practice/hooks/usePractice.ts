"use client";
import { useQuery } from "@tanstack/react-query";
import { getMySessions, getScenarios } from "../api/practice";

export const MY_SESSIONS_KEY = ["my-sessions"] as const;

export const useScenarios = () => useQuery({ queryKey: ["scenarios"], queryFn: getScenarios, staleTime: Infinity });
export const useMySessions = (limit = 5) =>
  useQuery({ queryKey: [...MY_SESSIONS_KEY, limit], queryFn: () => getMySessions(limit) });
