/** The pages a visitor without an account may open (guest mode). The API itself decides what a guest may do. Clerk's
 *  middleware (proxy.ts) takes this list as it is; `isPublicPath` is the same rule, readable by tests. */
export const PUBLIC_ROUTES = [
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/forgot-password(.*)",
  "/welcome",
  "/practice(.*)",
  "/ai-chat(.*)",
  "/plan(.*)",
  "/phrases(.*)", // a guest's own corrections (the API answers /me/corrections for guests)
  "/progress(.*)", // a guest's own numbers and last reports (the API answers /me/progress and /me/sessions for guests)
];

/** The menu a guest sees: the screens that work without an account. Each one must be a public route. */
export const GUEST_PATHS: readonly string[] = ["/practice", "/phrases", "/progress"];

const PATTERNS = PUBLIC_ROUTES.map((r) => new RegExp(`^${r.replace(/\(\.\*\)$/, "(?:/.*)?")}$`));
export const isPublicPath = (path: string) => PATTERNS.some((re) => re.test(path));
