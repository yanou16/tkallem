/**
 * Screens whose backend does not exist yet: out of every menu, and their routes redirect to /practice (a judge must never open a panel
 * that cannot load); the code stays, switch a flag on when its API is built.
 */
export const FEATURES = {
  // Practice groups (/groups/*, /me/group, WS /ws/groups/{id}): built, but hidden for the jury (docs/JURY_BRIEF.md F-4).
  // NEXT_PUBLIC_FEATURE_GROUPS=1 shows the menu link and the /groups page; absent or any other value hides both.
  // Read at build time: restart `npm run dev`, or redeploy, after changing it.
  groups: process.env.NEXT_PUBLIC_FEATURE_GROUPS === "1",
  notifications: false, // /api/notifications/*, notification preferences
  profileExtras: false, // bio, photo, goals, practice mode, daily goal, focus areas, languages, badges, AI preferences
} as const;
