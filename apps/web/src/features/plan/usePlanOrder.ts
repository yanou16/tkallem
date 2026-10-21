"use client";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { featuredFirst, goalFromLabel, planOrder, readInterests, type Interest } from "./lib/plan";

/** The list in the order of the student's plan (goal from the profile, subjects kept on this device). Without a plan the visa
 *  interview comes first: it is what the product is about. */
export function usePlanOrder<T extends { id: string; category: string | null }>(list: T[]) {
  const { user } = useCurrentUser();
  const [interests, setInterests] = useState<Interest[]>([]);
  useEffect(() => setInterests(readInterests()), []); // localStorage: read after mount, never during the server render
  const goal = goalFromLabel(user?.learningGoal);
  return useMemo(() => {
    const ordered = planOrder(list, goal, interests);
    return { list: goal === null ? featuredFirst(ordered) : ordered, hasPlan: goal !== null };
  }, [list, goal, interests]);
}
