"use client";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { scenarioTint } from "@/lib/tint";
import { Pill, Skeleton } from "@/components/ui";
import { cn, plural, timeAgo } from "@/lib/utils";
import type { Scenario, SessionSummary } from "@/features/practice/types/practice";

/** Practice by default; `mode: "interview"` opens the same scenario as a real interview (no feedback until the report). */
export const startHref = (scenarioId: string, mode: "practice" | "interview" = "practice") =>
  `/ai-chat?scenarioId=${encodeURIComponent(scenarioId)}${mode === "interview" ? "&mode=interview" : ""}`;

export function StartButton({ href, label = "Start" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black/80">
      {label} <ArrowRight size={14} />
    </Link>
  );
}

/** DESIGN.md "Scenario card": background = the scenario's tint (one meaning per pastel), text in charcoal. */
export function ScenarioCard({ s }: { s: Scenario }) {
  return (
    <article className={cn("flex flex-col justify-between gap-4 rounded-card p-5", scenarioTint(s.category))}>
      <div className="min-w-0">
        <h3 className="font-semibold leading-tight">{s.title}</h3>
        <p className="text-sm text-charcoal">
          {s.mode === "free" ? "Free conversation" : s.totalQuestions ? plural(s.totalQuestions, "question") : "Guided questions"}
        </p>
      </div>
      {s.description && <p className="text-sm text-charcoal">{s.description}</p>}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-charcoal">
          {s.minutes !== null && <><Clock size={14} /> {s.minutes} min</>}
          {s.level && <Pill>{s.level}</Pill>}
        </span>
        <StartButton href={startHref(s.id)} label="Practice" />
      </div>
      <Link href={startHref(s.id, "interview")} className="-mb-2 inline-flex min-h-11 items-center self-start text-sm font-medium text-ink underline underline-offset-2">
        Real interview: no corrections until the end
      </Link>
    </article>
  );
}

/** Opens a session: the conversation, or its report once it is finished. */
export const sessionHref = (s: SessionSummary) =>
  `/ai-chat?sessionId=${encodeURIComponent(s.id)}&scenarioId=${encodeURIComponent(s.scenarioId)}`;

function answered(s: SessionSummary) {
  return s.totalQuestions === null ? plural(s.answered, "answer") : `${s.answered}/${s.totalQuestions} answers`;
}

/** The student's sessions from GET /me/sessions. `actions` adds "Continue" (unfinished) or "Practice again" (finished). */
export function SessionList({ sessions, actions }: { sessions: SessionSummary[]; actions?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={sessionHref(s)} className="block truncate font-medium hover:underline">{s.title}</Link>
            <p className="text-sm text-muted">
              {answered(s)} · {s.endedAt ? "Finished" : "Not finished"} · {timeAgo(s.startedAt)}
            </p>
          </div>
          {actions && (s.endedAt
            ? <StartButton href={startHref(s.scenarioId)} label="Practice again" />
            : <StartButton href={sessionHref(s)} label="Continue" />)}
        </li>
      ))}
    </ul>
  );
}

export const CardsSkeleton = ({ n = 4, h = "h-40", cols = "md:grid-cols-2" }: { n?: number; h?: string; cols?: string }) => (
  <div className={cn("grid gap-4", cols)}>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={h} />)}</div>
);
