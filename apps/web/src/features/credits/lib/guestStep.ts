/** Routes a visitor may use without an account (must match the public routes of src/proxy.ts). */
export const GUEST_ROUTES = ["/practice", "/ai-chat", "/plan"];

/**
 * What the app does about the visitor's identity on this screen:
 * - "claim": just signed in with a guest token still stored: bring the guest's sessions and credits to the account;
 * - "create": signed out on a guest route without a token: ask the API for a guest (40 credits);
 * - "none": otherwise (the welcome page creates nobody: a guest is made only when the student starts practising).
 */
export function guestStep(signedIn: boolean, storedToken: string | null, pathname: string): "claim" | "create" | "none" {
  if (signedIn) return storedToken ? "claim" : "none";
  if (!storedToken && GUEST_ROUTES.some((r) => pathname.startsWith(r))) return "create";
  return "none";
}
