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

export const CALLOUTS: Record<Exclude<TourTab, "platform">, Callout[]> = {
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
export const REGIONS: Record<Exclude<TourTab, "platform">, string[]> = {
  plan: ["question", "progress", "skip", "choices", "result", "order"],
  voice: ["mic", "state", "transcript", "backup"],
};

/* ---------- the platform tab: a sidebar that works, one set of captions per page ---------- */
export type PlatformPage = "home" | "practice" | "chat" | "progress" | "profile";
/** The sidebar. The conversation ("chat") is not an entry: like the real app, it opens from Practice. */
export const PAGES: { id: Exclude<PlatformPage, "chat">; label: string }[] = [
  { id: "home", label: "Home" }, { id: "practice", label: "Practice" },
  { id: "progress", label: "Progress" }, { id: "profile", label: "Profile" },
];
/** The order the automatic tour visits the pages in. */
export const PAGE_ORDER: PlatformPage[] = ["home", "practice", "chat", "progress", "profile"];
/** The sidebar entry lit for a page. */
export const menuOf = (p: PlatformPage): Exclude<PlatformPage, "chat"> => (p === "chat" ? "practice" : p);
const c = (id: string, label: string, detail: string, side: "left" | "right", region = id): Callout => ({ id, label, detail, side, region });
export const PAGE_CALLOUTS: Record<PlatformPage, Callout[]> = {
  home: [
    c("nav", "Click the menu", "Every page of the app is live in this preview: try Practice, Progress, Profile.", "left"),
    c("kpi", "Progress that is measured", "Mistakes per 100 words, practice time and streak, from your own sessions.", "left"),
    c("plan", "Your plan, in order", "The situations that match your goal come first.", "left"),
    c("situations", "Real situations", "Visa, university admission, job, IELTS and everyday scenes like the taxi or renting a room.", "left"),
    c("credits", "Free to try", "Guests get 40 free answers. No account needed.", "right"),
    c("goal", "Today's goal", "Your daily minutes of speaking, as a ring.", "right"),
    c("real", "Real interview mode", "Nothing is corrected until the end, like the real one.", "right"),
    c("mistakes", "Your top mistakes", "What to work on next, from your last sessions.", "right"),
    c("recent", "Recent sessions", "Continue where you stopped, or do it again.", "right"),
  ],
  practice: [
    c("planlink", "Your plan, one tap away", "Redo the five questions whenever your goal changes.", "left"),
    c("grid", "Ten real situations", "Interviews, exams and everyday scenes, in the order of your plan. Tap a card: the conversation opens.", "left"),
    c("real", "Practice or Real interview", "Every situation can be run as the real thing.", "right"),
    c("recent", "Pick up where you left off", "Your recent sessions, one tap to continue or redo.", "right"),
  ],
  chat: [
    c("mode", "Practice or Real interview", "Practice corrects after each answer. Real interview shows nothing until the end.", "left"),
    c("question", "The real questions", "The coach plays the officer, the advisor or the recruiter.", "left"),
    c("help", "Help me start", "Frozen? Get the first words, or say your idea in French or Darija and get it in English.", "left"),
    c("feedback", "One good thing, one fix", "A true compliment first, then the correction that matters most.", "right"),
    c("again", "Say it again", "Repeat the corrected sentence. The code checks it, not the AI.", "right"),
    c("answer", "Type or speak", "Answer the way you prefer. Two free hints per question.", "right"),
  ],
  progress: [
    c("metrics", "Numbers, not feelings", "Mistakes, words per answer and hesitations, session after session.", "left"),
    c("freeze", "Time before you speak", "The seconds between the question and your first word: the freeze, made visible.", "left"),
    c("confidence", "How confident you feel", "You rate it before and after each session.", "right"),
    c("top", "Your top mistakes", "The rules you break most often, with your own sentences.", "right"),
  ],
  profile: [
    c("setup", "Your learning setup", "Level, goal, daily minutes and focus, filled by your plan.", "left"),
    c("lang", "Explained in French", "Corrections come in French or simple English, as you prefer.", "left"),
    c("focus", "What the coach keeps in mind", "The two things you said are hardest.", "right"),
    c("badges", "Badges to unlock", "First session, a streak, a spoken session.", "right"),
  ],
};
export const PAGE_REGIONS: Record<PlatformPage, string[]> = {
  home: ["nav", "kpi", "plan", "situations", "credits", "goal", "real", "mistakes", "recent"],
  practice: ["planlink", "grid", "real", "recent"],
  chat: ["mode", "question", "help", "feedback", "again", "answer"],
  progress: ["metrics", "freeze", "confidence", "top"],
  profile: ["setup", "lang", "focus", "badges"],
};
/** The captions of what is on screen: the page for the platform tab, the tab otherwise. */
export const calloutsFor = (tab: TourTab, page: PlatformPage): Callout[] => (tab === "platform" ? PAGE_CALLOUTS[page] : CALLOUTS[tab]);

/**
 * The captions of what is on screen right now. In the plan preview the questions and the result are two different screens:
 * once the plan is done only the captions of the result remain (the others would point at nothing).
 */
export function visibleCallouts(tab: TourTab, page: PlatformPage, planDone: boolean): Callout[] {
  const all = calloutsFor(tab, page);
  return tab === "plan" && planDone ? all.filter((c) => c.region === "result" || c.region === "order") : all;
}

/** The situations as the API lists them (same ids, titles, minutes, levels and categories). */
export const DEMO_SCENARIOS = [
  { id: "airport", title: "At the airport", category: "speaking", mode: "guided" as const, minutes: 6, level: "B1" },
  { id: "cafe", title: "Ordering at a cafe", category: "speaking", mode: "guided" as const, minutes: 5, level: "A2" },
  { id: "university-admission", title: "University admission interview", category: "study", mode: "guided" as const, minutes: 8, level: "B2" },
  { id: "free-talk", title: "Free talk", category: "speaking", mode: "free" as const, minutes: 10, level: "B1" },
  { id: "ielts-part2", title: "IELTS Speaking, part 2", category: "exams", mode: "guided" as const, minutes: 6, level: "B2" },
  { id: "job-remote", title: "Remote job interview", category: "work", mode: "guided" as const, minutes: 10, level: "B2" },
  { id: "shop", title: "In a clothes shop", category: "speaking", mode: "guided" as const, minutes: 5, level: "A2" },
  { id: "taxi", title: "Taking a taxi", category: "speaking", mode: "guided" as const, minutes: 5, level: "A2" },
  { id: "renting-a-room", title: "Renting a room", category: "speaking", mode: "guided" as const, minutes: 6, level: "B1" },
  { id: "visa-us", title: "Visa interview", category: "travel", mode: "guided" as const, minutes: 8, level: "B1" },
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
