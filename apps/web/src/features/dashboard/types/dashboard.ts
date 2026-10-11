export type DashboardData = {
  speakingMinutesThisWeek: number;
  streakDays: number;
  mistakesPer100Words: number | null; // null before the first answered session
  mistakesChange: number | null; // negative = fewer mistakes, null without a baseline yet
  mistakesChangeLabel?: string; // e.g. "in 2 weeks"
  dailyGoalMinutes: number;
  dailyCompletedMinutes: number;
};

export type TopMistake = {
  id: string;
  category: string;
  original: string;
  correction: string;
  count: number;
};
