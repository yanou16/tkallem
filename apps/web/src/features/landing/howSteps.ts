export type HowStep = { n: number; line: string };
export const HOW_STEPS: HowStep[] = [
 { n: 1, line: "Pick a real scenario." },
 { n: 2, line: "Answer out loud, or type." },
 { n: 3, line: "Understand each correction." },
 { n: 4, line: "Say it again until it sticks." },
];
/** The API stores text, not the student's recordings. */
export const PRIVACY_LINE = "We never store your audio. Only text.";
