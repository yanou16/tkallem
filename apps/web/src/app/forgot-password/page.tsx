"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { AuthCard, AuthField, AuthShell, FormError, PrimaryButton, clerkMessage } from "@/components/auth/AuthShell";

/** Password reset with a code sent by e-mail (Clerk custom flow). Accounts created with Google have no password. */
export default function ForgotPasswordPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email });
      setSent(true);
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const res = await signIn.attemptFirstFactor({ strategy: "reset_password_email_code", code, password });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.replace("/");
      } else {
        setError("This account needs a second verification step. Please sign in instead.");
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell mode="sign-in">
      {sent ? (
        <AuthCard title="Choose a new password" subtitle={`We sent a 6-digit code to ${email}.`}>
          <form onSubmit={reset} className="space-y-4">
            <AuthField label="Code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} required />
            <AuthField label="New password" password autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <FormError message={error} />
            <PrimaryButton type="submit" loading={loading}>Save and sign in</PrimaryButton>
          </form>
        </AuthCard>
      ) : (
        <AuthCard title="Forgot your password?" subtitle="Enter your e-mail and we will send you a code.">
          <form onSubmit={sendCode} className="space-y-4">
            <AuthField label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <FormError message={error} />
            <PrimaryButton type="submit" loading={loading}>Send the code</PrimaryButton>
            <p className="text-center text-[13px] text-[#6b6b75]">
              Signed up with Google? <Link href="/sign-in" className="font-medium text-ink underline underline-offset-2">Use Continue with Google</Link>
            </p>
          </form>
        </AuthCard>
      )}
    </AuthShell>
  );
}
