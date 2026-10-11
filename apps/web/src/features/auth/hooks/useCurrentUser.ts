"use client";
import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/getCurrentUser";
import { ApiError } from "@/lib/api/client";
import type { User } from "../types/user";

export const CURRENT_USER_KEY = ["current-user"] as const;

/** Single source of truth for the signed-in student. Cached globally by TanStack Query. */
export function useCurrentUser() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const q = useQuery({
    queryKey: CURRENT_USER_KEY,
    queryFn: async () => getCurrentUser(await getToken()),
    enabled: isAuthLoaded && isSignedIn === true,
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  // Name, photo and email are managed by Clerk; our API only stores the learning setup.
  const user: User | undefined =
    q.data && clerkUser
      ? {
          ...q.data,
          firstName: clerkUser.firstName || q.data.firstName || clerkUser.fullName || "Student",
          lastName: clerkUser.lastName || undefined,
          email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
          avatarUrl: clerkUser.imageUrl || undefined,
        }
      : undefined;

  return {
    user,
    isLoading: q.isLoading || (!isUserLoaded && isSignedIn === true),
    error: q.error as ApiError | null,
    refetch: q.refetch,
  };
}
