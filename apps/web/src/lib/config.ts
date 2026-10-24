/** Central place for env-driven configuration. No URLs live in components. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

/** Groups receive live events from the same API unless a separate socket origin is configured. */
export const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws")).replace(/\/$/, "");

export const ROUTES = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  home: "/",
} as const;
