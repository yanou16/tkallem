import type { DailyGoalMinutes, FocusArea, Level } from "@/features/auth/types/user";

/**
 * "Your plan": five questions that change real settings (level, daily goal, focus, the order of the situations).
 * Nothing here is generated: the situations are the same for everyone, the plan only chooses which come first.
 */
export type GoalId = "visa" | "study" | "job" | "ielts" | "daily";
export type Interest = "travel" | "study" | "work" | "exams" | "daily";

export type PlanAnswers = {
  goal: GoalId | null;
  level: Level | null;
  minutes: DailyGoalMinutes | null;
  focus: FocusArea[];
  interests: Interest[];
};

export const EMPTY_PLAN: PlanAnswers = { goal: null, level: null, minutes: null, focus: [], interests: [] };
export const MAX_FOCUS = 2;

/** `label` is what the profile stores in learning_goal, `first` the situations to practice first, in order. */
export const GOALS: { id: GoalId; label: string; first: string[] }[] = [
  { id: "visa", label: "Pass a visa interview", first: ["visa-us", "airport", "taxi", "renting-a-room"] },
  { id: "study", label: "Study abroad (admission, visa, life on campus)", first: ["university-admission", "visa-us", "renting-a-room", "free-talk"] },
  { id: "job", label: "Get a job or work remotely", first: ["job-remote", "free-talk", "cafe", "shop"] },
  { id: "ielts", label: "Prepare for IELTS Speaking", first: ["ielts-part2", "free-talk", "university-admission", "cafe"] },
  { id: "daily", label: "Speak English in daily life and travel", first: ["taxi", "shop", "cafe", "airport"] },
];

export const LEVEL_CHOICES: { level: Level; title: string; text: string }[] = [
  { level: "A2", title: "I know a few sentences", text: "I understand simple English, speaking is hard." },
  { level: "B1", title: "I can talk about familiar things", text: "I get by, but I stop to find words." },
  { level: "B2", title: "I speak, with mistakes", text: "I can explain my ideas, but not always correctly." },
  { level: "C1", title: "I am comfortable", text: "I want to sound more precise and natural." },
];

export const MINUTE_CHOICES: DailyGoalMinutes[] = [5, 10, 15, 20, 30];

export const FOCUS_CHOICES: { id: FocusArea; label: string; text: string }[] = [
  { id: "fluency", label: "I hesitate and freeze", text: "Starting to speak without long silences." },
  { id: "confidence", label: "I lack confidence", text: "Believing my English is good enough." },
  { id: "grammar", label: "Grammar", text: "Tenses, articles, prepositions." },
  { id: "vocabulary", label: "Words", text: "Finding the right word." },
  { id: "pronunciation", label: "Pronunciation", text: "Being understood the first time." },
  { id: "conversation", label: "Keeping a conversation going", text: "Answering fully, not in two words." },
];

/** The scenario categories each interest likes (GET /scenarios `category`). */
export const INTEREST_CHOICES: { id: Interest; label: string; categories: string[] }[] = [
  { id: "travel", label: "Travel", categories: ["travel"] },
  { id: "study", label: "Studies", categories: ["study"] },
  { id: "work", label: "Work", categories: ["work"] },
  { id: "exams", label: "Exams", categories: ["exams"] },
  { id: "daily", label: "Everyday life", categories: ["speaking"] },
];

export const goalLabel = (id: GoalId) => GOALS.find((g) => g.id === id)?.label ?? "";
/** The goal stored in the profile, back to its id (a goal typed on the profile page matches nothing). */
export const goalFromLabel = (label: string | null | undefined): GoalId | null => GOALS.find((g) => g.label === label)?.id ?? null;

export const toggleFocus = (focus: FocusArea[], id: FocusArea): FocusArea[] =>
  focus.includes(id) ? focus.filter((f) => f !== id) : focus.length >= MAX_FOCUS ? focus : [...focus, id];

export const toggleInterest = (list: Interest[], id: Interest): Interest[] =>
  list.includes(id) ? list.filter((i) => i !== id) : [...list, id];

export const isComplete = (a: PlanAnswers) => a.goal !== null && a.level !== null && a.minutes !== null && a.focus.length > 0;

/** What is saved in the profile (PATCH /me). The interests stay on this device: the API has no field for them. */
export function toProfileUpdate(a: PlanAnswers) {
  return {
    ...(a.level ? { level: a.level } : {}),
    ...(a.minutes ? { dailyGoalMinutes: a.minutes } : {}),
    ...(a.goal ? { learningGoal: goalLabel(a.goal) } : {}),
    ...(a.focus.length ? { focusAreas: a.focus } : {}),
  };
}

type Orderable = { id: string; category: string | null };

/**
 * The situations in the order of the plan: the goal's own list first, then those of a liked subject, then the rest
 * in their original order. Without a goal and without interests the list is unchanged.
 */
export function planOrder<T extends Orderable>(list: T[], goal: GoalId | null, interests: Interest[]): T[] {
  const first = GOALS.find((g) => g.id === goal)?.first ?? [];
  const liked = new Set(INTEREST_CHOICES.filter((c) => interests.includes(c.id)).flatMap((c) => c.categories));
  const rank = (s: T) => {
    const i = first.indexOf(s.id);
    if (i >= 0) return i;
    return liked.has(s.category ?? "") ? first.length : first.length + 1;
  };
  return list.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
}

/** The situation the product is about. The API lists situations alphabetically, so without a plan it would be the fourth card. */
export const FEATURED_SCENARIO = "visa-us";

/** The featured situation first, the others in their order. A list without it is returned as it is. */
export function featuredFirst<T extends { id: string }>(list: T[]): T[] {
  const i = list.findIndex((s) => s.id === FEATURED_SCENARIO);
  return i <= 0 ? list : [list[i], ...list.slice(0, i), ...list.slice(i + 1)];
}

/** The path shown at the end: guided situations only (free talk has no goal), at most four. */
export const planPath = <T extends Orderable & { mode: "guided" | "free" }>(list: T[], goal: GoalId | null, interests: Interest[]) =>
  planOrder(list, goal, interests).filter((s) => s.mode === "guided").slice(0, 4);

/** The four tinted meanings of docs/DESIGN.md: an interview or an exam. Everything else is an everyday situation. */
export const INTERVIEW_CATEGORIES = new Set(["travel", "study", "work", "exams"]);

/**
 * The Practice page in two groups: interviews and exams (what the student came for) first, everyday situations second.
 * The plan still orders each group; a student whose plan starts with an everyday situation (the goal "daily life") gets that
 * group first. Without a plan the list is in the API's order (alphabetical, which starts with an everyday scene): never
 * reorder the groups then. Empty groups are left out.
 */
export function groupSituations<T extends Orderable>(ordered: T[], planned = false): { title: string; list: T[] }[] {
  const real = ordered.filter((s) => INTERVIEW_CATEGORIES.has(s.category ?? ""));
  const daily = ordered.filter((s) => !INTERVIEW_CATEGORIES.has(s.category ?? ""));
  const groups = [{ title: "Interviews and exams", list: real }, { title: "Everyday situations", list: daily }].filter((g) => g.list.length > 0);
  if (planned && groups.length === 2 && !INTERVIEW_CATEGORIES.has(ordered[0].category ?? "")) groups.reverse();
  return groups;
}

const KEY = "tkallem.plan.interests";
export const readInterests = (): Interest[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((i): i is Interest => INTEREST_CHOICES.some((c) => c.id === i)) : [];
  } catch { return []; }
};
export const saveInterests = (list: Interest[]) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private window */ } };
