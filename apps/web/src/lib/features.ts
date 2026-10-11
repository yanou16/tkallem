/**
 * Screens whose backend does not exist yet. They are hidden for the October delivery (a judge must never open a panel
 * that cannot load); the code stays, switch a flag on when its API is built.
 */
export const FEATURES = {
  groups: false, // /api/groups/*: study groups, posts, group sessions
  notifications: false, // /api/notifications/*, notification preferences
  profileExtras: false, // bio, photo, goals, practice mode, daily goal, focus areas, languages, badges, AI preferences
} as const;
