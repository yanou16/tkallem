"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { AuthCard, AuthShell, FormError, clerkMessage } from "@/components/auth/AuthShell";
import { completeUsername } from "@/features/auth/lib/username";

/** A Google sign-up that Clerk could not finish alone (it wants a username): we finish it here, without a form. */
export default function ContinueSignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const [error, setError] = useState("");
  const done = useRef(false);

  useEffect(() => {
    if (!isLoaded || done.current) return;
    done.current = true;
    if (!signUp?.status) {
      router.replace("/sign-in"); // nothing in progress: the page was opened directly
      return;
    }
    completeUsername(signUp as never)
      .then(async (sessionId) => {
        if (!sessionId) {
          setError(`Your account needs more information (${signUp.missingFields.join(", ")}). Please sign up with e-mail.`);
          return;
        }
        await setActive({ session: sessionId });
        router.replace("/");
      })
      .catch((err) => setError(clerkMessage(err)));
  }, [isLoaded, signUp, setActive, router]);

  return (
    <AuthShell mode="sign-up">
      <AuthCard title="Setting up your account" subtitle="One moment, we are finishing your sign-up.">
        {error ? (
          <div className="space-y-3">
            <FormError message={error} />
            <Link href="/sign-up" className="text-[13px] font-medium text-ink underline underline-offset-2">Back to sign up</Link>
          </div>
        ) : (
          <p className="text-sm text-[#6b6b75]">Signing you in…</p>
        )}
      </AuthCard>
    </AuthShell>
  );
}
