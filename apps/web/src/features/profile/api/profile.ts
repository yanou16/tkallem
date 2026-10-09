import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { User } from "@/features/auth/types/user";
import type { Achievement, ActivityItem, Preferences, UpdateProfileInput } from "../types/profile";

export const updateProfile = (input: UpdateProfileInput) => api.patch<User>(endpoints.user.me, input);
export const addLanguage = (input: { code: string; level: string }) => api.post(endpoints.user.languages, input);
export const getAchievements = () => api.get<Achievement[]>(endpoints.user.achievements);
export const getActivity = () => api.get<ActivityItem[]>(endpoints.user.activity);
export const getPreferences = () => api.get<Preferences>(endpoints.user.preferences);
export const updatePreferences = (input: Partial<Preferences["notifications"]>) =>
  api.patch<Preferences>(endpoints.user.preferences, { notifications: input });
export const getUnreadCount = () => api.get<{ count: number }>(endpoints.user.notificationsUnread);

export const uploadAvatar = (file: File) => {
  const form = new FormData();
  form.append("avatar", file);
  return api.post<User>(endpoints.user.avatar, form);
};
