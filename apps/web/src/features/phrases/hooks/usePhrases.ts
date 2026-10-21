"use client";
import { useQuery } from "@tanstack/react-query";
import { getPhrases } from "../api/phrases";

export const usePhrases = (limit = 50) => useQuery({ queryKey: ["my-corrections", limit], queryFn: () => getPhrases(limit) });
