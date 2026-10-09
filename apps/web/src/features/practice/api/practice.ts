import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PracticeFocus, RecentSession, Scenario } from "../types/practice";

export const getScenarios = (category?: string) =>
  api.get<Scenario[]>(endpoints.practice.scenarios, { query: { category } });
export const getRecentSessions = () => api.get<RecentSession[]>(endpoints.practice.recent);
export const getRecommended = () => api.get<Scenario[]>(endpoints.practice.recommended);
export const getFocus = () => api.get<PracticeFocus | null>(endpoints.practice.focus);
