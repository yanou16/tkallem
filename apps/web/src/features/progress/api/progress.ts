import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { Progress, ProgressDto, ProgressMetrics, ProgressMetricsDto, TopMistake, TopMistakeDto } from "../types/progress";

export const mapMetrics = (m: ProgressMetricsDto): ProgressMetrics => ({
  mistakesPer100: m.mistakes_per_100,
  wordsPerAnswer: m.words_per_answer,
  hesitationsPerMin: m.hesitations_per_min,
  speakingSeconds: m.speaking_seconds,
});

const mapTopMistake = (m: TopMistakeDto): TopMistake => ({
  id: m.id,
  category: m.category,
  original: m.original,
  correction: m.correction,
  count: m.count,
});

export const mapProgress = (p: ProgressDto): Progress => ({
  current: mapMetrics(p.current),
  baseline: p.baseline ? mapMetrics(p.baseline) : null,
  mistakesChange: p.mistakes_change,
  topMistakes: p.top_mistakes.map(mapTopMistake),
  weekSpeakingSeconds: p.week_speaking_seconds,
  todaySpeakingSeconds: p.today_speaking_seconds,
  dailyGoalSeconds: p.daily_goal_seconds,
  streakDays: p.streak_days,
});

export const getProgress = () => api.get<ProgressDto>(endpoints.progress).then(mapProgress);
