import type { DailyGoalMinutes, FocusArea, Level } from "@/features/auth/types/user";
import { MAX_FOCUS, planPath, toggleFocus, toggleInterest, type GoalId, type Interest } from "@/features/plan/lib/plan";

/**
 * The welcome page tour: three tabs (the connected platform, the plan, the voice). Each has captions on both sides; a
 * caption lights up the part of the preview it talks about (its `region`). Pure data and logic, tested in tour.test.ts.
 * The plan tab runs the real ordering code (planOrder), so the order shown is the order a student would get.
 */
export type TourTab = "platform" | "plan" | "voice";
export type Callout = { id: string; label: string; detail: string; side: "left" | "right"; region: string };

export const TABS: { id: TourTab; label: string; title: string; text: string }[] = [
  { id: "platform", label: "The platform", title: "Everything in one place", text: "What a student sees after signing up: the plan, the situations, the progress." },
  { id: "plan", label: "Your plan", title: "Five questions, then your order", text: "Answer them in the preview: the order of the situations changes with your goal." },
  { id: "voice", label: "Voice", title: "Say it out loud, hear the coach answer", text: "Tap the microphone and answer. The coach replies in a natural voice." },
];

export const CALLOUTS: Record<TourTab, Callout[]> = {
  platform: [
    { id: "kpi", label: "Progress that is measured", detail: "Mistakes per 100 words, practice time and streak, from your own sessions.", side: "left", region: "kpi" },
    { id: "plan", label: "Your plan, in order", detail: "The situations that match your goal come first.", side: "left", region: "plan" },
    { id: "groups", label: "Groups of your level", detail: "Write in English with other students (needs an account).", side: "left", region: "groups" },
    { id: "situations", label: "Real situations", detail: "Visa, Campus France, job, IELTS and everyday scenes like the taxi or the cafe.", side: "left", region: "situations" },
    { id: "credits", label: "Free to try", detail: "Guests get 40 free answers. No account needed.", side: "right", region: "credits" },
    { id: "goal", label: "Today's goal", detail: "Your daily minutes of speaking, as a ring.", side: "right", region: "goal" },
    { id: "real", label: "Real interview mode", detail: "Nothing is corrected until the end, like the real one.", side: "right", region: "real" },
    { id: "mistakes", label: "Your top mistakes", detail: "What to work on next, from your last sessions.", side: "right", region: "mistakes" },
    { id: "recent", label: "Recent sessions", detail: "Continue where you stopped, or do it again.", side: "right", region: "recent" },
  ],
  plan: [
    { id: "progress", label: "One at a time", detail: "A progress bar and a Back button. Nothing heavy.", side: "left", region: "progress" },
    { id: "question", label: "Five short questions", detail: "Goal, level, time, what is hardest, subjects you like.", side: "left", region: "question" },
    { id: "skip", label: "Skip any time", detail: "Straight into a visa interview, no account.", side: "left", region: "skip" },
    { id: "choices", label: "Tap an answer", detail: "Each answer changes a real setting.", side: "right", region: "choices" },
    { id: "result", label: "Your plan, saved", detail: "Level, daily goal, goal and focus go in your profile.", side: "right", region: "result" },
    { id: "order", label: "The order of your situations", detail: "The situations are the same for everyone: your answers decide which come first.", side: "right", region: "order" },
  ],
  voice: [
    { id: "mic", label: "Tap to speak", detail: "One tap to record, one tap to send.", side: "left", region: "mic" },
    { id: "state", label: "You always know what is happening", detail: "Listening, Thinking, Speaking: one label at a time.", side: "left", region: "state" },
    { id: "transcript", label: "Your words, written", detail: "Your speech is transcribed and corrected like a typed answer.", side: "right", region: "transcript" },
    { id: "backup", label: "A voice that never fails", detail: "If a provider is down, another takes over, then your browser's voice.", side: "right", region: "backup" },
  ],
};

/** The parts each preview renders: a caption may only point at one of them (tested). */
export const REGIONS: Record<TourTab, string[]> = {
  platform: ["plan", "situations", "groups", "kpi", "credits", "real", "goal", "mistakes", "recent"],
  plan: ["question", "progress", "skip", "choices", "result", "order"],
  voice: ["mic", "state", "transcript", "backup"],
};

/** The situations as the API lists them (same ids, titles, minutes, levels and categories). */
export const DEMO_SCENARIOS = [
  { id: "airport", icon: "airport", title: "At the airport", category: "speaking", mode: "guided" as const, minutes: 6, level: "B1" },
  { id: "cafe", icon: "cafe", title: "Ordering at a cafe", category: "speaking", mode: "guided" as const, minutes: 5, level: "A2" },
  { id: "campus-france", icon: "university", title: "Campus France interview", category: "study", mode: "guided" as const, minutes: 8, level: "B2" },
  { id: "free-talk", icon: "chat", title: "Free talk", category: "speaking", mode: "free" as const, minutes: 10, level: "B1" },
  { id: "ielts-part2", icon: "mic", title: "IELTS Speaking, part 2", category: "exams", mode: "guided" as const, minutes: 6, level: "B2" },
  { id: "job-remote", icon: "laptop", title: "Remote job interview", category: "work", mode: "guided" as const, minutes: 10, level: "B2" },
  { id: "shop", icon: "shop", title: "In a clothes shop", category: "speaking", mode: "guided" as const, minutes: 5, level: "A2" },
  { id: "taxi", icon: "taxi", title: "Taking a taxi", category: "speaking", mode: "guided" as const, minutes: 5, level: "A2" },
  { id: "visa-business", icon: "plane", title: "Business or tourist visa", category: "travel", mode: "guided" as const, minutes: 8, level: "B1" },
  { id: "visa-us", icon: "plane", title: "Visa interview", category: "travel", mode: "guided" as const, minutes: 8, level: "B1" },
];
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

/* ---------- the plan preview ---------- */
export const PLAN_STEPS = 5;
export type PlanDemo = {
  step: number; // 0 to 4: a question; 5: the result
  goal: GoalId | null;
  level: Level | null;
  minutes: DailyGoalMinutes | null;
  focus: FocusArea[];
  interests: Interest[];
};
export const INITIAL_PLAN: PlanDemo = { step: 0, goal: null, level: null, minutes: null, focus: [], interests: [] };
export const DEFAULTS = { goal: "visa" as GoalId, level: "A2" as Level, minutes: 10 as DailyGoalMinutes, focus: ["fluency"] as FocusArea[] };

export type PlanAction =
  | { type: "goal"; value: GoalId } | { type: "level"; value: Level } | { type: "minutes"; value: DailyGoalMinutes }
  | { type: "focus"; value: FocusArea } | { type: "interest"; value: Interest }
  | { type: "next" } | { type: "back" } | { type: "finish" } | { type: "reset" };

export function planReducer(s: PlanDemo, a: PlanAction): PlanDemo {
  switch (a.type) {
    case "goal": return { ...s, goal: a.value, step: s.step === 0 ? 1 : s.step }; // answering the question moves on, a later caption does not move back
    case "level": return { ...s, level: a.value, step: s.step === 1 ? 2 : s.step };
    case "minutes": return { ...s, minutes: a.value, step: s.step === 2 ? 3 : s.step };
    case "focus": return { ...s, focus: toggleFocus(s.focus, a.value) };
    case "interest": return { ...s, interests: toggleInterest(s.interests, a.value) };
    case "next": return { ...s, step: Math.min(PLAN_STEPS, s.step + 1) };
    case "back": return { ...s, step: Math.max(0, s.step - 1) };
    case "finish": // a caption about the result: show it, with defaults for what was not answered
      return { ...s, step: PLAN_STEPS, goal: s.goal ?? DEFAULTS.goal, level: s.level ?? DEFAULTS.level, minutes: s.minutes ?? DEFAULTS.minutes, focus: s.focus.length ? s.focus : DEFAULTS.focus };
    case "reset": return INITIAL_PLAN;
  }
}

/** What the platform tab and the result show: the student's answers, or the defaults. */
export function planView(s: PlanDemo) {
  const goal = s.goal ?? DEFAULTS.goal;
  return {
    goal, level: s.level ?? DEFAULTS.level, minutes: s.minutes ?? DEFAULTS.minutes,
    focus: s.focus.length ? s.focus : DEFAULTS.focus,
    path: planPath(DEMO_SCENARIOS, goal, s.interests) as DemoScenario[],
  };
}

export { MAX_FOCUS };
