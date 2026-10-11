"use client";
import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "../api/getCurrentUser";
import { ApiError } from "@/lib/api/client";
import { getActiveLanguage, type User } from "../types/user";
import { useGuestToken } from "@/features/credits/hooks/useCredits";

export const CURRENT_USER_KEY = ["current-user"] as const;

/** Single source of truth for the signed-in account. Cached globally by TanStack Query. */
export function useCurrentUser() {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const guestToken = useGuestToken();
  const isGuest = isAuthLoaded && isSignedIn !== true && guestToken !== null;
  const q = useQuery({
    queryKey: [...CURRENT_USER_KEY, isGuest ? "guest" : "signed-in"],
    queryFn: async () => getCurrentUser(isGuest ? null : await getToken()), // a guest is identified by its stored token
    enabled: isAuthLoaded && (isSignedIn === true || isGuest),
    staleTime: 5 * 60_000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  const combinedUser: User | undefined = q.data
    ? {
        ...q.data,
        firstName: q.data.firstName || clerkUser?.firstName || clerkUser?.fullName || "Student",
        lastName: q.data.lastName || clerkUser?.lastName || undefined,
        email: q.data.email || clerkUser?.primaryEmailAddress?.emailAddress || "",
        avatarUrl: q.data.avatarUrl || clerkUser?.imageUrl || undefined,
      }
    : clerkUser
    ? {
        id: "current-user",
        firstName: clerkUser.firstName || clerkUser.fullName || "Student",
        lastName: clerkUser.lastName || undefined,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        avatarUrl: clerkUser.imageUrl || undefined,
        learningLanguages: [],
        explainLang: "fr",
      }
    : undefined;

  return {
    user: combinedUser,
    activeLanguage: getActiveLanguage(combinedUser),
    isGuest,
    hasProfile: q.data !== undefined, // the API answered (the Clerk fallback above has no level)
    isLoading: q.isLoading || (!isUserLoaded && isSignedIn === true),
    error: q.error as ApiError | null,
    refetch: q.refetch,
  };
}
