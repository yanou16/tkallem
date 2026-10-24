"use client";
import { cn } from "@/lib/utils";

export type CoachState = "idle" | "listening" | "thinking" | "speaking";

/** DESIGN.md state indicator: one shape per state, always with a word, never a face. */
export default function VoiceState({ state, seconds, className }: { state: CoachState; seconds?: number; className?: string }) {
  if (state === "idle") return null;
  const label =
    state === "listening" ? `Listening… ${formatTime(seconds ?? 0)}` : state === "thinking" ? "Thinking…" : "Speaking…";
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-3", className)}>
      {state === "listening" && (
        <span className="flex h-6 items-center gap-[3px]" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="tk-bar h-6 w-[3px] rounded-full bg-ink" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </span>
      )}
      {state === "thinking" && (
        <span className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="tk-dot h-2.5 w-2.5 rounded-full bg-ink" style={{ animationDelay: `${i * 150}ms` }} />)}
        </span>
      )}
      {state === "speaking" && <span className="tk-breathe h-6 w-6 rounded-full bg-ink" aria-hidden />}
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
