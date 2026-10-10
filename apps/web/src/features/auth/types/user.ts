/** Adapt this file to the real backend schema. Nothing else defines a User. */
export type LearningLanguage = {
  id: string;
  code: string;
  name: string;
  level: string;
  flagUrl?: string;
};

export type User = {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  nativeLanguage?: string;
  learningLanguages: LearningLanguage[];
  activeLanguage?: LearningLanguage;
  learningGoal?: string;
  dailyGoalMinutes?: number;
  preferredPracticeMode?: string;
  focusAreas?: string[];
  level?: "A2" | "B1" | "B2" | "C1";
  explainLang?: "en" | "fr";
};

export type MeResponse = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  learning_goal?: string | null;
  daily_goal_minutes?: number | null;
  preferred_practice_mode?: string | null;
  focus_areas?: string[] | null;
  learning_languages?: LearningLanguage[] | null;
  level: User["level"] | null;
  explain_lang: NonNullable<User["explainLang"]>;
};

export type LoginInput = { email: string; password: string; remember?: boolean };
export type RegisterInput = { firstName: string; lastName?: string; email: string; password: string };
export type AuthResponse = { token?: string; accessToken?: string };

export function getActiveLanguage(user?: User | null): LearningLanguage | undefined {
  return user?.activeLanguage ?? user?.learningLanguages?.[0] ??
    (user?.level ? { id: "profile", code: "en", name: "English", level: user.level } : undefined);
}

export function toUser(me: MeResponse): User {
  return {
    id: "current-user",
    firstName: me.first_name ?? "",
    lastName: me.last_name ?? undefined,
    email: me.email ?? "",
    avatarUrl: me.avatar_url ?? undefined,
    bio: me.bio ?? undefined,
    learningGoal: me.learning_goal ?? undefined,
    dailyGoalMinutes: me.daily_goal_minutes ?? 15,
    preferredPracticeMode: me.preferred_practice_mode ?? "text",
    focusAreas: me.focus_areas ?? [],
    learningLanguages: me.learning_languages?.length
      ? me.learning_languages
      : me.level
      ? [{ id: "profile", code: "en", name: "English", level: me.level }]
      : [],
    level: me.level ?? undefined,
    explainLang: me.explain_lang,
  };
}
