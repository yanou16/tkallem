/** The four steps of the loop, shown on the landing page. Every picture is a real crop of the live app
 *  (docs/pitch-assets/README.md says how they were captured). `w` and `h` are the real pixel size of each file. */
export type HowStep = { n: number; line: string; src: string; w: number; h: number; alt: string };

export const HOW_STEPS: HowStep[] = [
  { n: 1, line: "Pick a real scenario: visa interview.", src: "/landing/how-1-pick.png", w: 780, h: 460,
    alt: "The Visa interview scenario is open and the coach asks: What is the purpose of your trip?" },
  { n: 2, line: "Answer out loud, or type.", src: "/landing/how-2-answer.png", w: 780, h: 330,
    alt: "A round Tap to speak microphone button, a Help me start button and a field to type the answer" },
  { n: 3, line: "Get one priority fix, with praise.", src: "/landing/how-3-fix.png", w: 780, h: 765,
    alt: "A student answer with a correction under it: Good detail, then one fix, for studying becomes to study, with a short explanation in French" },
  { n: 4, line: "Say it again until it is clean.", src: "/landing/how-4-again.png", w: 780, h: 270,
    alt: "The corrected sentence to say out loud, and a Stop and check button while the student records it again" },
];

/** True: the API never writes the student's audio anywhere (apps/api/app/voice/stt.py), only the text is saved. */
export const PRIVACY_LINE = "We never store your audio. Only text.";
