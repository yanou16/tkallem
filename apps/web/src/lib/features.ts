/**
 * Screens whose backend does not exist yet: out of every menu, and their routes redirect to /practice (a judge must never open a panel
 * that cannot load); the code stays, switch a flag on when its API is built.
 */
export const FEATURES = {
  groups: true, // practice groups: /groups/*, /me/group and WS /ws/groups/{id}
  notifications: false, // /api/notifications/*, notification preferences
  profileExtras: false, // bio, photo, goals, practice mode, daily goal, focus areas, languages, badges, AI preferences
} as const;
