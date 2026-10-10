"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateProfile } from "../api/profile";
import { CURRENT_USER_KEY } from "@/features/auth/hooks/useCurrentUser";

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (me) => {
      qc.setQueryData(CURRENT_USER_KEY, me);
      // The daily goal is part of /me/progress.
      qc.invalidateQueries({ queryKey: ["progress"] });
    },
  });
}
