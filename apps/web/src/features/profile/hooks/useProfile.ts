"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as p from "../api/profile";
import { CURRENT_USER_KEY } from "@/features/auth/hooks/useCurrentUser";
import type { Preferences } from "../types/profile";
import { FEATURES } from "@/lib/features";

export const useAchievements = () => useQuery({ queryKey: ["achievements"], queryFn: p.getAchievements, enabled: FEATURES.profileExtras });
export const useActivity = () => useQuery({ queryKey: ["activity"], queryFn: p.getActivity });
export const usePreferences = () => useQuery({ queryKey: ["preferences"], queryFn: p.getPreferences, enabled: FEATURES.notifications });
export const useUnreadCount = () =>
  useQuery({ queryKey: ["notifications-unread"], queryFn: p.getUnreadCount, refetchInterval: 60_000, retry: false, enabled: FEATURES.notifications });

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: p.updateProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CURRENT_USER_KEY });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}

export function useAddLanguage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: p.addLanguage, onSuccess: () => qc.invalidateQueries({ queryKey: CURRENT_USER_KEY }) });
}

export function useUpdateNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: p.updatePreferences,
    onSuccess: (data) => qc.setQueryData<Preferences>(["preferences"], data),
    onSettled: () => qc.invalidateQueries({ queryKey: ["preferences"] }),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: p.uploadAvatar, onSuccess: () => qc.invalidateQueries({ queryKey: CURRENT_USER_KEY }) });
}
