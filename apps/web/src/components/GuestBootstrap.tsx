"use client";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ApiError, guestFailure, guestStore } from "@/lib/api/client";
import { claimGuest, createGuest } from "@/features/credits/api/credits";
import { guestStep } from "@/features/credits/lib/guestStep";
import { useGuestToken } from "@/features/credits/hooks/useCredits";


/**
 * Keeps the visitor identity in order:
 * - signed out on a guest route and no token yet: ask the API for a guest account (40 credits);
 * - just signed in with a guest token still stored: bring the guest's sessions and credits to the account.
 */
export default function GuestBootstrap() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const qc = useQueryClient();
  const busy = useRef(false);
  const token = useGuestToken(); // re-run when the token is cleared (API reset): a new guest is asked for at once

  useEffect(() => {
    if (!isLoaded || busy.current) return;
    const stored = guestStore.get();

    const step = guestStep(isSignedIn === true, stored, pathname);
    if (step === "claim" && stored) {
      busy.current = true;
      claimGuest(stored)
        .catch((e) => { if (e instanceof ApiError && e.status === 422) guestStore.clear(); return null; }) // forged token: forget it
        .then((r) => { if (r) guestStore.clear(); })
        .finally(() => { busy.current = false; qc.invalidateQueries(); });
      return;
    }

    if (step === "create") {
      busy.current = true;
      createGuest()
        .then((g) => { guestFailure.set(false); guestStore.set(g.guest_token); })
        .catch(() => guestFailure.set(true)) // 429 (too many visitors) or 503 (guest mode off): the page asks to sign in
        .finally(() => { busy.current = false; });
    }
  }, [isLoaded, isSignedIn, pathname, qc, token]);

  return null;
}
