"use client";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/getCurrentUser";
import { ApiError } from "@/lib/api/client";
import { getActiveLanguage } from "../types/user";

export const CURRENT_USER_KEY = ["current-user"] as const;

/** Single source of truth for the signed-in account. Cached globally by TanStack Query. */
export function useCurrentUser() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const q = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: async () => getCurrentUser(await getToken()),
    enabled: isLoaded && isSignedIn === true,
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });
  return {
    user: q.data,
    activeLanguage: getActiveLanguage(q.data),
    isLoading: q.isLoading,
    error: q.error as ApiError | null,
    refetch: q.refetch,
  };
}
