export type Achievement = { id: string; title: string; description: string; icon: string };
export type ActivityItem = { id: string; title: string; detail: string; createdAt: string; icon: string };
export type NotificationPreferences = {
  practiceReminders: boolean;
  groupActivity: boolean;
  achievements: boolean;
  productUpdates: boolean;
};
export type AiPreferences = { correctionStyle?: string; voiceSpeed?: string; preferredTopics?: string[] };
export type Preferences = { notifications: NotificationPreferences; ai: AiPreferences };

export type UpdateProfileInput = Partial<{
  firstName: string;
  lastName: string;
  bio: string;
  avatarUrl: string;
  learningGoal: string;
  dailyGoalMinutes: number;
  preferredPracticeMode: string;
  focusAreas: string[];
  activeLanguageId: string;
  level: "A2" | "B1" | "B2" | "C1";
  explainLang: "en" | "fr";
}>;
