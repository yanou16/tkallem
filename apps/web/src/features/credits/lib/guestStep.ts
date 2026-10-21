import { GUEST_PATHS } from "@/lib/publicRoutes";

/** Routes where a visitor without a token gets a guest account. The menu pages come from `GUEST_PATHS`, so a page added
 *  there (Progress was missed once) is covered; the conversation and the plan are public but not in the menu. */
export const GUEST_ROUTES = [...GUEST_PATHS, "/ai-chat", "/plan"];

/**
 * What the app does about the visitor's identity on this screen:
 * - "claim": just signed in with a guest token still stored: bring the guest's sessions and credits to the account;
 * - "create": signed out on a guest route without a token: ask the API for a guest (100 credits);
 * - "none": otherwise (the welcome page creates nobody: a guest is made only when the student starts practising).
 */
export function guestStep(signedIn: boolean, storedToken: string | null, pathname: string): "claim" | "create" | "none" {
  if (signedIn) return storedToken ? "claim" : "none";
  if (!storedToken && GUEST_ROUTES.some((r) => pathname.startsWith(r))) return "create";
  return "none";
}
