"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useSignUp } from "@clerk/nextjs";
import TryWithoutAccount from "@/components/auth/TryWithoutAccount";
import { completeUsername } from "@/features/auth/lib/username";
import { AuthShell, AuthCard, AuthField, PrimaryButton, FormError, GoogleButton, OrDivider, clerkMessage } from "@/components/auth/AuthShell";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  /* If already signed in, skip the form and go home */
  useEffect(() => {
    if (isSignedIn) {
      router.replace("/");
    }
  }, [isSignedIn, router]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await signUp.create({
        firstName,
        lastName: lastName || undefined,
        emailAddress: email,
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
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
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });
    } catch (err) {
      setError(clerkMessage(err));
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setLoading(true);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code });
      // The Clerk instance may require a username, which this form does not ask for: it is made from the e-mail.
      const sessionId = res.status === "complete" ? res.createdSessionId : await completeUsername(res as never);
      if (sessionId) {
        await setActive({ session: sessionId });
        router.push("/");
      } else {
        setError(`Your account needs more information (${res.missingFields.join(", ")}).`);
      }
    } catch (err) {
      setError(clerkMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell mode="sign-up">
      {verifying ? (
        <AuthCard title="Check your email" subtitle={`We sent a 6-digit code to ${email}.`}>
          <form onSubmit={onVerify} className="space-y-4">
            <AuthField
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <FormError message={error} />
            <PrimaryButton type="submit" loading={loading}>
              Verify email
            </PrimaryButton>
          </form>
        </AuthCard>
      ) : (
        <AuthCard title="Create your account" subtitle="Practise real interviews with your AI coach.">
          <TryWithoutAccount />
          <form onSubmit={onSubmit} className="space-y-4">
            <GoogleButton onClick={onGoogle} loading={!isLoaded} label="Sign up with Google" />
            <OrDivider />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <AuthField
                label="First name"
                placeholder="Enter your first name"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <AuthField
                label="Last name"
                hint="optional"
                placeholder="Enter your last name"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
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
              placeholder="Create a password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <AuthField
              label="Confirm password"
              password
              placeholder="Confirm your password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <FormError message={error} />

            {/* Requis par Clerk (protection anti-bot) */}
            <div id="clerk-captcha" />

            <div className="pt-1">
              <PrimaryButton type="submit" loading={loading}>
                Create account
              </PrimaryButton>
            </div>

            <p className="pt-1 text-center text-[13px] text-muted">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-ink underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </form>
        </AuthCard>
      )}
    </AuthShell>
  );
}