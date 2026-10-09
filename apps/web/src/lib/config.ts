/** Central place for env-driven configuration. No URLs live in components. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const AUTH_MODE: "cookie" | "bearer" =
  process.env.NEXT_PUBLIC_AUTH_MODE === "bearer" ? "bearer" : "cookie";

export const ROUTES = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  home: "/",
} as const;
