"use client";
import { useQuery } from "@tanstack/react-query";
import { getProgress } from "../api/progress";
import type { ProgressRange } from "../types/progress";

export const useProgress = (range: ProgressRange) =>
  useQuery({ queryKey: ["progress", range], queryFn: () => getProgress(range) });
