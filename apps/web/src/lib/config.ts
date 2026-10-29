/** Central place for env-driven configuration. No URLs live in components. */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
/** The API's WebSocket address (groups). Without NEXT_PUBLIC_WS_URL: the API URL with ws:// or wss://. */
export const WS_URL = (process.env.NEXT_PUBLIC_WS_URL || API_URL.replace(/^http/, "ws")).replace(/\/$/, "");

/** What a visitor without an account may answer for free (the API's GUEST_CREDITS: a jury must be able to test freely). */
export const GUEST_FREE_ANSWERS = 1000;
/** What signing in adds, and what comes back every day (the API's LOGIN_BONUS and DAILY_REFILL on the demo server). */
export const SIGNUP_BONUS_ANSWERS = 200;
export const DAILY_NEW_ANSWERS = 50;

export const ROUTES = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  home: "/",
} as const;
