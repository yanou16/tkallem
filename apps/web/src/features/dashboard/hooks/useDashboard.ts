"use client";
import { useQuery } from "@tanstack/react-query";
import { getDashboard, getTopMistakes } from "../api/dashboard";

export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
export const useTopMistakes = () => useQuery({ queryKey: ["top-mistakes"], queryFn: getTopMistakes });
