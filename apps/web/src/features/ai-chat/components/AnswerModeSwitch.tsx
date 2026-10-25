"use client";
import { MessageCircle, Mic, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANSWER_MODE_HINT, ANSWER_MODE_LABEL, type AnswerMode } from "../lib/answerMode";

const ICON: Record<AnswerMode, typeof Mic> = { call: Phone, voice: Mic, text: MessageCircle };

/**
 * How the student answers: Call, Voice message or Text. Each says what it is in its own words, and the line under the
 * switch repeats it for the one that is chosen, so a visitor who opens the app alone understands the difference.
 */
export default function AnswerModeSwitch({ modes, value, onChange, showHint = true, className }: {
  modes: AnswerMode[]; value: AnswerMode; onChange: (mode: AnswerMode) => void; showHint?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <div role="radiogroup" aria-label="How do you want to answer?" className="flex rounded-full bg-surface p-0.5">
        {modes.map((m) => {
          const I = ICON[m];
          return (
            <button key={m} type="button" role="radio" aria-checked={value === m} onClick={() => onChange(m)}
              className={cn("inline-flex min-h-11 min-w-0 flex-auto items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition-colors active:scale-[0.98]",
                value === m ? "bg-ink text-white" : "text-slate")}>
              <I size={15} aria-hidden className="shrink-0" />
              <span className="truncate">{ANSWER_MODE_LABEL[m]}</span>
            </button>
          );
        })}
      </div>
      {showHint && <p className="mt-2 px-1 text-sm leading-snug text-slate">{ANSWER_MODE_HINT[value]}</p>}
    </div>
  );
}
