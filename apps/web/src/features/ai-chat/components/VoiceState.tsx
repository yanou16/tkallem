"use client";
import { cn } from "@/lib/utils";

export type CoachState = "idle" | "listening" | "thinking" | "preparing" | "speaking";

/** DESIGN.md state indicator: one shape per state, always with a word, never a face. */
export default function VoiceState({ state, seconds, className, label: custom }: { state: CoachState; seconds?: number; className?: string; label?: string }) {
  if (state === "idle") return null;
  const label = custom ?? stateLabel(state, seconds ?? 0);
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-3", className)}>
      {state === "listening" && (
        <span className="flex h-6 items-center gap-[3px]" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="tk-bar h-6 w-[3px] rounded-full bg-ink" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </span>
      )}
      {(state === "thinking" || state === "preparing") && (
        <span className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="tk-dot h-2.5 w-2.5 rounded-full bg-ink" style={{ animationDelay: `${i * 150}ms` }} />)}
        </span>
      )}
      {state === "speaking" && <span className="tk-breathe h-6 w-6 rounded-full bg-ink" aria-hidden />}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/** The word that always goes with the shape (DESIGN.md). "Preparing": the reply is on screen, its voice is being made. */
export function stateLabel(state: CoachState, seconds = 0): string {
  switch (state) {
    case "listening": return `Listening… ${formatTime(seconds)}`;
    case "thinking": return "Thinking…";
    case "preparing": return "Preparing the voice…";
    case "speaking": return "Speaking…";
    default: return "";
  }
}

export function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
