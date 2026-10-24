import type { Progress } from "@/features/progress/types/progress";
import type { Achievement } from "@/features/profile/types/profile";
export const PREVIEW_PROGRESS: Progress = {
 current: { mistakesPer100: 1.4, wordsPerAnswer: 48, hesitationsPerMin: 5, speakingSeconds: 300 },
 baseline: { mistakesPer100: 4.5, wordsPerAnswer: 39, hesitationsPerMin: 7, speakingSeconds: 180 },
 mistakesChange: -3.1, weekSpeakingSeconds: 2520, todaySpeakingSeconds: 360, dailyGoalSeconds: 600, streakDays: 3,
 topMistakes: [{ id: "tense", category: "verb_tense", original: "I goed home", correction: "I went home", count: 3 }, { id: "article", category: "article", original: "to US", correction: "to the US", count: 2 }],
};
export const PREVIEW_BADGES: Achievement[] = [
 { id: "first", title: "First session", description: "Finish your first practice session.", icon: "star", unlocked: true },
 { id: "ten", title: "Ten sessions", description: "Finish 10 practice sessions.", icon: "trophy", unlocked: false },
 { id: "three", title: "3-day streak", description: "Practice 3 days in a row.", icon: "flame", unlocked: true },
 { id: "seven", title: "7-day streak", description: "Practice 7 days in a row.", icon: "flame", unlocked: false },
 { id: "spoken", title: "First spoken session", description: "Answer every question out loud.", icon: "mic", unlocked: false },
 { id: "level", title: "Level B1", description: "Practice at level B1 or above.", icon: "sprout", unlocked: true },
];
