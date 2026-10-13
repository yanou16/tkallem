/** The interactive product preview of the welcome page: what each tab shows, the captions around it, and the state of the
 *  mini chat. Pure, so it is tested in demo.test.ts. Everything shown is example data: the preview never calls the API and
 *  never spends a credit. */
export type DemoTab = "web" | "phone" | "voice" | "report";

export const TABS: { id: DemoTab; label: string; title: string; text: string }[] = [
  { id: "web", label: "On the web", title: "A real interview, corrected as you go", text: "The coach asks the real questions. Answer by typing or speaking; each answer comes back with what was good and the one fix that matters." },
  { id: "phone", label: "On your phone", title: "Installs like an app, no store", text: "Open the link on your phone and add it to your home screen. Same coach, same corrections, thumb-sized buttons." },
  { id: "voice", label: "Voice coach", title: "Say it out loud, hear the coach answer", text: "Tap the microphone and answer. The coach hears you, replies in a natural voice, and shows the corrections while it speaks." },
  { id: "report", label: "Your report", title: "See the freeze go down", text: "After each interview: your progress, how long you waited before starting, and how confident you feel. Compare your first session and your third." },
];

/** A caption around the preview. `region` is the part of the preview it points at. */
export type Callout = { id: string; label: string; detail: string; side: "left" | "right"; region: string };

export const CALLOUTS: Record<DemoTab, Callout[]> = {
  web: [
    { id: "mode", label: "Practice or Real interview", detail: "Practice corrects after each answer. Real interview shows nothing until the end, like the real one.", side: "left", region: "mode" },
    { id: "question", label: "The real questions", detail: "The coach plays the visa officer, the advisor or the recruiter and asks questions from real interviews.", side: "left", region: "question" },
    { id: "help", label: "Help me start", detail: "Frozen? Get the first words of an answer, or say your idea in French or Darija and get it in English.", side: "left", region: "help" },
    { id: "answer", label: "Type or speak", detail: "Answer the way you prefer. Two free hints per question, no credit spent.", side: "right", region: "answer" },
    { id: "feedback", label: "One thing that was good, one fix", detail: "A true compliment first, then the correction that matters most. The other small fixes stay folded.", side: "right", region: "feedback" },
    { id: "again", label: "Say it again", detail: "Repeat the corrected sentence out loud. The code checks it, not the AI: Nailed it, or a gentle hint.", side: "right", region: "again" },
  ],
  phone: [
    { id: "install", label: "Add to home screen", detail: "On Android, Install. On iPhone, Share then Add to Home Screen. It opens full screen.", side: "left", region: "screen" },
    { id: "nostore", label: "No download", detail: "It is a web app: nothing to find in a store, and it updates by itself.", side: "left", region: "screen" },
    { id: "thumb", label: "Thumb-sized buttons", detail: "Every button is at least 44 px, and nothing scrolls sideways on a small phone.", side: "right", region: "thumb" },
    { id: "same", label: "Same coach, same account", detail: "Start on your phone, finish on your laptop. Guests get 40 free answers, no sign-up.", side: "right", region: "thumb" },
  ],
  voice: [
    { id: "mic", label: "Tap to speak", detail: "One tap to record, one tap to send. A silent recording is refused before it is sent.", side: "left", region: "mic" },
    { id: "state", label: "You always know what is happening", detail: "Listening, Thinking, Speaking: one label at a time, so you never wonder if it heard you.", side: "left", region: "state" },
    { id: "transcript", label: "Your words, written", detail: "Your speech is transcribed and corrected like a typed answer.", side: "right", region: "transcript" },
    { id: "voice", label: "A voice that never fails", detail: "If a voice provider is down, another takes over, then your browser's own voice.", side: "right", region: "state" },
  ],
  report: [
    { id: "progress", label: "Progress first", detail: "The report opens with what improved since your last interview, written by code, never invented.", side: "left", region: "progress" },
    { id: "freeze", label: "Time before you speak", detail: "The seconds between the question and your first word: the freeze, made visible.", side: "left", region: "freeze" },
    { id: "confidence", label: "How confident you feel", detail: "You rate it before and after. The report compares the two.", side: "right", region: "confidence" },
    { id: "redo", label: "The answer to redo", detail: "Your mistakes per 100 words, and the one answer worth doing again first.", side: "right", region: "redo" },
  ],
};

/** The parts of each preview that a caption can point at (the preview must render one element for each). */
export const REGIONS: Record<DemoTab, string[]> = {
  web: ["mode", "question", "help", "answer", "feedback", "again"],
  phone: ["screen", "thumb"],
  voice: ["mic", "state", "transcript"],
  report: ["progress", "freeze", "confidence", "redo"],
};

/* ---------- the mini chat (web and phone previews) ---------- */

export type Fix = { original: string; fixed: string; why: string };
export type DemoAnswer = { text: string; praise: string; fix: Fix; more: Fix[] };

export const QUESTION = "What is the purpose of your trip?";
export const STARTERS = ["The main purpose of my trip is to…", "I am going to the US to…"];

export const ANSWERS: DemoAnswer[] = [
  {
    text: "I go to the US for study.",
    praise: "Clear goal: you go to the US.",
    fix: { original: "for study", fixed: "to study", why: "Pour exprimer le but, on utilise to + verbe." },
    more: [],
  },
  {
    text: "Yesterday I go to the embassy and he have my papers.",
    praise: "Good detail: 'the embassy'.",
    fix: { original: "I go", fixed: "I went", why: "Un événement terminé hier demande le passé." },
    more: [{ original: "he have", fixed: "he has", why: "Avec he, on écrit has." }],
  },
];

export type Mode = "practice" | "interview";
export type ChatStep = "asking" | "helped" | "answered" | "nailed";
export type ChatState = { step: ChatStep; mode: Mode; picked: number | null; helpUsed: boolean; foldedOpen: boolean };

export const INITIAL_CHAT: ChatState = { step: "asking", mode: "practice", picked: null, helpUsed: false, foldedOpen: false };

export type ChatAction =
  | { type: "help" }
  | { type: "pick"; index: number }
  | { type: "nail" }
  | { type: "mode"; mode: Mode }
  | { type: "fold" }
  | { type: "reset" };

export function chatReducer(s: ChatState, a: ChatAction): ChatState {
  switch (a.type) {
    case "help":
      // Help me start is a practice tool, and only before the answer.
      return s.mode === "practice" && s.picked === null ? { ...s, step: "helped", helpUsed: true } : s;
    case "pick":
      return a.index in ANSWERS ? { ...s, picked: a.index, step: "answered", foldedOpen: false } : s;
    case "nail":
      // Say it again only exists in practice, after a correction.
      return s.mode === "practice" && s.picked !== null ? { ...s, step: "nailed" } : s;
    case "mode":
      return { ...INITIAL_CHAT, mode: a.mode };
    case "fold":
      return { ...s, foldedOpen: !s.foldedOpen };
    case "reset":
      return { ...INITIAL_CHAT, mode: s.mode };
  }
}

/** What the student sees under their answer: nothing in a real interview, the feedback in practice. */
export function feedbackFor(s: ChatState): { kind: "none" } | { kind: "hidden" } | { kind: "shown"; answer: DemoAnswer } {
  if (s.picked === null) return { kind: "none" };
  return s.mode === "interview" ? { kind: "hidden" } : { kind: "shown", answer: ANSWERS[s.picked] };
}

/* ---------- the voice preview ---------- */

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";
const NEXT: Record<VoiceState, VoiceState> = { idle: "listening", listening: "thinking", thinking: "speaking", speaking: "idle" };
export const nextVoiceState = (s: VoiceState): VoiceState => NEXT[s];
export const VOICE_LABEL: Record<VoiceState, string> = { idle: "Tap to speak", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…" };

/* ---------- the report preview ---------- */

export type ReportSession = 1 | 3;
export const REPORTS: Record<ReportSession, { progress: string; freeze: string; freezeNote: string; confidence: string; mistakes: string; redo: string }> = {
  1: {
    progress: "First interview done: this is your starting point.",
    freeze: "9.3 s", freezeNote: "Measured on 4 answers.",
    confidence: "Before: 2/5",
    mistakes: "8.2 mistakes per 100 words",
    redo: "Redo: “Yesterday I go to the embassy…”",
  },
  3: {
    progress: "You spoke 40 seconds longer than last time.",
    freeze: "3.4 s", freezeNote: "Down from 9.3 s last time.",
    confidence: "You feel more confident: 2/5 before, 4/5 now.",
    mistakes: "3.1 mistakes per 100 words",
    redo: "Redo: “I will stay two years…”",
  },
};


/* ---------- the guided tour: each step shows its part in action ---------- */

export type StepView = { chat: ChatState; voice: VoiceState; report: ReportSession };

const apply = (...actions: ChatAction[]) => actions.reduce(chatReducer, INITIAL_CHAT);

/** What the preview shows at step `index` of a tab (0-based): the part the caption explains already happening. */
export function stepView(tab: DemoTab, index: number): StepView {
  const base: StepView = { chat: INITIAL_CHAT, voice: "idle", report: 3 };
  const i = Math.max(0, Math.min(index, CALLOUTS[tab].length - 1));
  if (tab === "web") {
    // mode, question, help, answer, feedback, again
    const chats = [INITIAL_CHAT, INITIAL_CHAT, apply({ type: "help" }), apply({ type: "help" }), apply({ type: "pick", index: 1 }), apply({ type: "pick", index: 1 }, { type: "nail" })];
    return { ...base, chat: chats[i] };
  }
  if (tab === "voice") return { ...base, voice: (["idle", "listening", "thinking", "speaking"] as const)[i] };
  return base;
}

/** The number written on a caption and on the part of the preview it points at: the order to read them in. */
export function numbers(tab: DemoTab): Record<string, number> {
  const out: Record<string, number> = {};
  CALLOUTS[tab].forEach((c, i) => { out[c.region] ??= i + 1; });
  return out;
}
