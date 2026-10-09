import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ProgressData, ProgressRange } from "../types/progress";

export const getProgress = (range: ProgressRange) => api.get<ProgressData>(endpoints.progress, { query: { range } });
