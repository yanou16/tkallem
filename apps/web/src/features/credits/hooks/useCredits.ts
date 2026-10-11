"use client";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { GUEST_EVENT, guestFailure, guestStore } from "@/lib/api/client";
import { getCredits } from "../api/credits";

export const CREDITS_KEY = ["credits"] as const;

/** The visitor's guest token (null once signed in). Re-renders when it is created or removed. */
export function useGuestToken(): string | null {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setToken(guestStore.get());
    read();
    window.addEventListener(GUEST_EVENT, read);
    return () => window.removeEventListener(GUEST_EVENT, read);
  }, []);
  return token;
}

export function useGuestFailed(): boolean {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const read = () => setFailed(guestFailure.get());
    read();
    window.addEventListener(GUEST_EVENT, read);
    return () => window.removeEventListener(GUEST_EVENT, read);
  }, []);
  return failed;
}

/** Who is using the app: a signed-in student, a guest, or nobody yet. */
export function useIdentity() {
  const { isLoaded, isSignedIn } = useAuth();
  const guestToken = useGuestToken();
  const guestFailed = useGuestFailed();
  return {
    guestFailed,
    isLoaded,
    isSignedIn: isSignedIn === true,
    isGuest: isLoaded && isSignedIn !== true && guestToken !== null,
    ready: isLoaded && (isSignedIn === true || guestToken !== null),
  };
}

export function useCredits() {
  const { ready } = useIdentity();
  return useQuery({ queryKey: CREDITS_KEY, queryFn: getCredits, enabled: ready, staleTime: 30_000 });
}
