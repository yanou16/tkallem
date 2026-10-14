"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import TryWithoutAccount from "@/components/auth/TryWithoutAccount";
import { AuthShell, AuthCard, AuthField, PrimaryButton, FormError, GoogleButton, OrDivider, clerkMessage } from "@/components/auth/AuthShell";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  /* If already signed in, skip the form and go home */
  useEffect(() => {
    if (isSignedIn) {
      router.replace("/");
    }
  }, [isSignedIn, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: "/" });
    } finally {
      setSigningOut(false);
    }
  }

  /* Don't render the form while redirecting */
  if (isSignedIn) return null;



  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const res = await signIn.create({ identifier: email, password });
      if (res.status === "complete") {
        await setActive({ session: res.createdSessionId });
        router.push("/");
      } else {
        setError("Additional verification is required to sign in.");
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    if (!isLoaded) return;
    setError("");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      setError(clerkMessage(err));
    }
  }

  return (
    <AuthShell mode="sign-in">
      <AuthCard title="Welcome back" subtitle="Pick up where you stopped.">
        <TryWithoutAccount />
        <form onSubmit={onSubmit} className="space-y-4">
          <GoogleButton onClick={onGoogle} loading={!isLoaded} />
          <OrDivider />
          <AuthField
            label="Email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthField
            label="Password"
            password
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex justify-end pt-1">
            <Link href="/forgot-password" className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-ink underline underline-offset-2">
              Forgot password?
            </Link>
          </div>

          <FormError message={error} />

          <div className="pt-1">
            <PrimaryButton type="submit" loading={loading}>
              Sign in
            </PrimaryButton>
          </div>

          <p className="pt-1 text-center text-sm text-[#6b6b75]">
            Don&apos;t have an account?{" "}
            <Link href="/sign-up" className="inline-flex min-h-11 items-center px-1 font-medium text-ink underline underline-offset-2">
              Create an account
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthShell>
  );
}