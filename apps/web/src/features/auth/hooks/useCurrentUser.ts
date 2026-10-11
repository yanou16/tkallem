"use client";
import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/getCurrentUser";
import { ApiError } from "@/lib/api/client";
import type { User } from "../types/user";
import { useGuestToken } from "@/features/credits/hooks/useCredits";

export const CURRENT_USER_KEY = ["current-user"] as const;

/** Single source of truth for the student (signed in, or a guest without account). Cached by TanStack Query. */
export function useCurrentUser() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const guestToken = useGuestToken();
  const isGuest = isAuthLoaded && isSignedIn !== true && guestToken !== null;
  const q = useQuery({
    // A guest has its own entry, so signing in never shows the guest's profile (and PATCH /me updates CURRENT_USER_KEY).
    queryKey: isGuest ? [...CURRENT_USER_KEY, "guest"] : CURRENT_USER_KEY,
    queryFn: async () => getCurrentUser(isGuest ? null : await getToken()), // a guest is identified by its stored token
    enabled: isAuthLoaded && (isSignedIn === true || isGuest),
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  // Name, photo and email are managed by Clerk; our API only stores the learning setup.
  const user: User | undefined =
    q.data && (clerkUser || isGuest)
      ? {
          ...q.data,
          firstName: clerkUser?.firstName || q.data.firstName || clerkUser?.fullName || (isGuest ? "Guest" : "Student"),
          lastName: clerkUser?.lastName || undefined,
          email: clerkUser?.primaryEmailAddress?.emailAddress ?? "",
          avatarUrl: clerkUser?.imageUrl || undefined,
        }
      : undefined;

  return {
    user,
    isGuest,
    hasProfile: q.data !== undefined, // the API answered: a missing level is real, not "still loading"
    isLoading: q.isLoading || (!isUserLoaded && isSignedIn === true),
    error: q.error as ApiError | null,
    refetch: q.refetch,
  };
}
