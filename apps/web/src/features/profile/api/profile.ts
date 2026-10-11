import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { MeResponse, User } from "@/features/auth/types/user";
import type { SessionSummary } from "@/features/progress/types/progress";
import type { Achievement, ActivityItem, Preferences, UpdateProfileInput } from "../types/profile";

export const updateProfile = (input: UpdateProfileInput) => {
  const body: Record<string, any> = {};
  if (input.firstName !== undefined) body.first_name = input.firstName;
  if (input.lastName !== undefined) body.last_name = input.lastName;
  if (input.bio !== undefined) body.bio = input.bio;
  if (input.avatarUrl !== undefined) body.avatar_url = input.avatarUrl;
  if (input.learningGoal !== undefined) body.learning_goal = input.learningGoal;
  if (input.dailyGoalMinutes !== undefined) body.daily_goal_minutes = input.dailyGoalMinutes;
  if (input.preferredPracticeMode !== undefined) body.preferred_practice_mode = input.preferredPracticeMode;
  if (input.focusAreas !== undefined) body.focus_areas = input.focusAreas;
  if (input.learningLanguages !== undefined) body.learning_languages = input.learningLanguages;
  if (input.level !== undefined) body.level = input.level;
  if (input.explainLang !== undefined) body.explain_lang = input.explainLang;
  return api.patch<MeResponse>(endpoints.user.me, body);
};
export const addLanguage = (input: { code: string; level: string }) => api.post(endpoints.user.languages, input);
export const getAchievements = () => api.get<Achievement[]>(endpoints.user.achievements);
/** Recent activity = the latest practice sessions (GET /me/sessions). */
export const getActivity = async (): Promise<ActivityItem[]> => {
  const sessions = await api.get<SessionSummary[]>(endpoints.practice.recent, { query: { limit: 5 } });
  return sessions.map((s) => ({
    id: s.session_id,
    title: s.title,
    detail: s.ended_at ? `Finished · ${s.answered} answers` : `${s.answered} answer${s.answered === 1 ? "" : "s"}, not finished`,
    createdAt: s.started_at,
    icon: s.ended_at ? "trophy" : "chat",
  }));
};
export const getPreferences = () => api.get<Preferences>(endpoints.user.preferences);
export const updatePreferences = (input: Partial<Preferences["notifications"]>) =>
  api.patch<Preferences>(endpoints.user.preferences, { notifications: input });
export const getUnreadCount = () => api.get<{ count: number }>(endpoints.user.notificationsUnread);

export const uploadAvatar = (file: File) => {
  const form = new FormData();
  form.append("avatar", file);
  return api.post<User>(endpoints.user.avatar, form);
};
