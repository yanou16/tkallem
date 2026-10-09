import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ProgressData } from "../types/progress";

export const getProgress = () => api.get<ProgressData>(endpoints.progress);
