import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { mapMe } from "@/features/auth/api/getCurrentUser";
import type { MeDto } from "@/features/auth/types/user";
import type { MeUpdateDto, UpdateProfileInput } from "../types/profile";

/** Only the fields present in the input are sent. */
export function mapProfileUpdate(input: UpdateProfileInput): MeUpdateDto {
  const body: MeUpdateDto = {};
  if (input.level !== undefined) body.level = input.level;
  if (input.explainLang !== undefined) body.explain_lang = input.explainLang;
  if (input.dailyGoalMinutes !== undefined) body.daily_goal_minutes = input.dailyGoalMinutes;
  if (input.learningGoal !== undefined) body.learning_goal = input.learningGoal;
  if (input.practiceMode !== undefined) body.practice_mode = input.practiceMode;
  if (input.focusAreas !== undefined) body.focus_areas = input.focusAreas;
  return body;
}

export const updateProfile = (input: UpdateProfileInput) =>
  api.patch<MeDto>(endpoints.me, mapProfileUpdate(input)).then(mapMe);
