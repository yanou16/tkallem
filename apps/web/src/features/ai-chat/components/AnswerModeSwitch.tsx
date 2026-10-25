"use client";
import { useRef, type KeyboardEvent } from "react";
import { MessageCircle, Mic, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ANSWER_MODE_HINT, ANSWER_MODE_LABEL, ANSWER_MODE_SHORT, type AnswerMode } from "../lib/answerMode";

const ICON: Record<AnswerMode, typeof Mic> = { call: Phone, voice: Mic, text: MessageCircle };

/**
 * How the student answers: Live call, Voice message or Text. Each says what it is in its own words, and the line under
 * the switch repeats it for the one that is chosen, so a visitor who opens the app alone understands the difference.
 * `lockedTo`: the call is on, so the others are out of reach and the line says how to leave (End call), instead of a
 * tap on the switch hanging up by accident.
 */
export default function AnswerModeSwitch({ modes, value, onChange, showHint = true, shortHint = false, lockedTo, className }: {
  modes: AnswerMode[]; value: AnswerMode; onChange: (mode: AnswerMode) => void; showHint?: boolean; shortHint?: boolean; lockedTo?: AnswerMode; className?: string;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const hint = lockedTo ? "End the call to change how you answer." : (shortHint ? ANSWER_MODE_SHORT : ANSWER_MODE_HINT)[value];

  // Radio group keys: arrows move the choice, and only the chosen radio is a Tab stop.
  const onKeyDown = (e: KeyboardEvent) => {
    if (lockedTo) return;
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (modes.indexOf(value) + step + modes.length) % modes.length;
    onChange(modes[next]);
    buttons.current[next]?.focus();
  };

  return (
    <div className={className}>
      <div role="radiogroup" aria-label="How do you want to answer?" onKeyDown={onKeyDown} className="flex rounded-full bg-surface p-0.5">
        {modes.map((m, i) => {
          const I = ICON[m];
          const locked = !!lockedTo && m !== lockedTo;
          return (
            <button key={m} ref={(el) => { buttons.current[i] = el; }} type="button" role="radio" aria-checked={value === m} disabled={locked}
              tabIndex={value === m ? 0 : -1} onClick={() => onChange(m)}
              className={cn("inline-flex min-h-11 min-w-0 flex-auto items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-45",
                value === m ? "bg-ink text-white" : "text-slate")}>
              <I size={15} aria-hidden className="shrink-0 max-[359px]:hidden" />
              <span className="truncate">{ANSWER_MODE_LABEL[m]}</span>
            </button>
          );
        })}
      </div>
      {showHint && <p aria-live="polite" className="mt-2 px-1 text-sm leading-snug text-slate">{hint}</p>}
    </div>
  );
}
