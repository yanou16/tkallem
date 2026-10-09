export type StatWithChange = { value: number; change: number; changeUnit?: "percent" | "absolute" };

export type ProgressData = {
  stats: {
    speakingMinutes: StatWithChange; // value in minutes
    streakDays: StatWithChange;
    lessonsCompleted: StatWithChange;
    weakPoints: StatWithChange;
  };
  goal: { dailyGoalMinutes: number; completedMinutes: number };
  speakingTime: { label: string; minutes: number }[];
  skills: { key: string; label: string; percent: number; level: string; icon?: string }[];
  nextMilestone?: { title: string; currentMinutes: number; targetMinutes: number } | null;
  mistakes: { id: string; category: string; original: string; correction: string; count: number }[];
  vocabulary: { id: string; word: string; category: string; count: number; icon?: string }[];
  recentImprovements: { id: string; label: string; description: string; changePercent: number; icon?: string }[];
};

export type ProgressRange = "4w" | "8w" | "12w";
