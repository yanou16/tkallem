"use client";
import { useQuery } from "@tanstack/react-query";
import { getProgress } from "../api/progress";

export const useProgress = () =>
  useQuery({ queryKey: ["progress"], queryFn: getProgress });
