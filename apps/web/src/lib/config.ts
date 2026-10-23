/** Central place for env-driven configuration. No URLs live in components. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** What a visitor without an account may answer for free (the API's GUEST_CREDITS: a jury must be able to test freely). */
export const GUEST_FREE_ANSWERS = 100;

export const ROUTES = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  home: "/",
} as const;
