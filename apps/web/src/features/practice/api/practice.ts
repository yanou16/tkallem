import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { PracticeFocus, RecentSession, Scenario } from "../types/practice";

// TODO: GET /scenarios. The API does not list scenarios yet: these are copied from
// packages/agent/tkallem_agent/scenarios/*.json (id, title, mode, minutes). Keep them in sync until then.
const SCENARIOS: Scenario[] = [
  { id: "visa-us", title: "Visa interview", mode: "guided", minutes: 8 },
  { id: "campus-france", title: "Campus France interview", mode: "guided", minutes: 8 },
  { id: "job-remote", title: "Remote job interview", mode: "guided", minutes: 10 },
  { id: "ielts-part2", title: "IELTS Speaking, part 2", mode: "guided", minutes: 6 },
  { id: "free-talk", title: "Free talk", mode: "free", minutes: null },
];

export const getScenarios = async (): Promise<Scenario[]> => SCENARIOS;
export const getRecentSessions = () => api.get<RecentSession[]>(endpoints.practice.recent);
export const getFocus = () => api.get<PracticeFocus | null>(endpoints.practice.focus);
