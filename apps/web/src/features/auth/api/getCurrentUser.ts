import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { Me, MeDto } from "../types/user";

export const mapMe = (me: MeDto): Me => ({
  firstName: me.first_name,
  level: me.level,
  explainLang: me.explain_lang,
  dailyGoalMinutes: me.daily_goal_minutes,
  learningGoal: me.learning_goal,
  practiceMode: me.practice_mode,
  focusAreas: me.focus_areas,
});

export const getCurrentUser = (token: string | null) =>
  api.get<MeDto>(endpoints.me, { token }).then(mapMe);
