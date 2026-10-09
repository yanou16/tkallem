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
};

export type LoginInput = { email: string; password: string; remember?: boolean };
export type RegisterInput = { firstName: string; lastName?: string; email: string; password: string };
export type AuthResponse = { token?: string; accessToken?: string };

export function getActiveLanguage(user?: User | null): LearningLanguage | undefined {
  return user?.activeLanguage ?? user?.learningLanguages?.[0];
}
