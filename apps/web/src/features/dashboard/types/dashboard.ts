export type DashboardData = {
  speakingMinutesThisWeek: number;
  streakDays: number;
  mistakesPer100Words: number;
  mistakesChange: number; // negative = fewer mistakes
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
