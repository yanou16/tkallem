import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/** Return from Google. Every follow-up stays on our pages: without these URLs Clerk falls back to its hosted pages. */
export default function SSOCallbackPage() {
  return (
    <AuthenticateWithRedirectCallback
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      continueSignUpUrl="/sso-callback/continue"
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    />
  );
}
