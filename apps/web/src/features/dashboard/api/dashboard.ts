import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { DashboardData, TopMistake } from "../types/dashboard";

export const getDashboard = () => api.get<DashboardData>(endpoints.dashboard);
export const getTopMistakes = () => api.get<TopMistake[]>(endpoints.mistakes.top);
