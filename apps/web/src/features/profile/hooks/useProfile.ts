"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getAchievements, updateProfile } from "../api/profile";
import { CURRENT_USER_KEY } from "@/features/auth/hooks/useCurrentUser";

export const ACHIEVEMENTS_KEY = ["achievements"] as const;

export const useAchievements = () => useQuery({ queryKey: ACHIEVEMENTS_KEY, queryFn: getAchievements });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (me) => {
      qc.setQueryData(CURRENT_USER_KEY, me);
      // The daily goal is part of /me/progress, and the level unlocks a badge.
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ACHIEVEMENTS_KEY });
    },
  });
}
