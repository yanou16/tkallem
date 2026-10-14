"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useConfidence } from "../hooks/useAiChat";
import { SCALE } from "../lib/confidence";

type Props = {
  sessionId: string;
  when: "before" | "after";
  question: string;
  value: number | null; // the answer already given, if any
  onSkip?: () => void;
};

/** "How confident do you feel?", 1 to 5 (docs/IMPACT.md): the student's own number, before the interview and after
 *  the report. Skippable, and changeable until they leave. Never required to go on. */
export default function ConfidenceAsk({ sessionId, when, question, value, onSkip }: Props) {
  const save = useConfidence(sessionId);
  const [picked, setPicked] = useState<number | null>(value);
  const choose = (v: number) => { setPicked(v); save.mutate({ when, value: v }); };
  const label = SCALE.find((s) => s.value === picked)?.label;

  return (
    <section aria-label={question} className="min-w-0 rounded-2xl border border-line bg-surface p-3 text-sm">
      <p id={`ask-${when}`} className="font-medium text-ink">{question}</p>
      <div role="radiogroup" aria-labelledby={`ask-${when}`} className="mt-2 flex flex-wrap items-center gap-2">
        {SCALE.map((s) => (
          <button key={s.value} role="radio" aria-checked={picked === s.value} aria-label={`${s.value}, ${s.label}`}
            onClick={() => choose(s.value)}
            className={cn("flex h-11 w-11 items-center justify-center rounded-full border text-base font-semibold",
              picked === s.value ? "border-ink bg-ink text-white" : "border-hairline-strong bg-white text-ink")}>
            {s.value}
          </button>
        ))}
        {onSkip && picked === null && (
          <button onClick={onSkip} className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-medium text-ink underline underline-offset-2">Skip</button>
        )}
      </div>
      <p role="status" className="mt-1 min-h-5 text-slate">
        {save.isError ? "Could not save, try again." : label ? `${label}. Thank you.` : "1 = not at all, 5 = very."}
      </p>
    </section>
  );
}
