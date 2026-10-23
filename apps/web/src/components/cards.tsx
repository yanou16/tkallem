"use client";
import Link from "next/link";
import { ScenarioArt, scenarioContext } from "./ScenarioArt";
import { ArrowRight, Clock } from "lucide-react";
import { Icon } from "@/lib/icons";
import { Pill, Skeleton, toneBg, toneDeep, type Tone } from "@/components/ui";
import { cn, plural, timeAgo } from "@/lib/utils";
import type { Scenario, SessionSummary } from "@/features/practice/types/practice";

/** Practice by default; `mode: "interview"` opens the same scenario as a real interview (no feedback until the report). */
export const startHref = (scenarioId: string, mode: "practice" | "interview" = "practice") =>
  `/ai-chat?scenarioId=${encodeURIComponent(scenarioId)}${mode === "interview" ? "&mode=interview" : ""}`;

export function IconBadge({ name, tone, size = 44 }: { name?: string; tone: Tone; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className={cn("flex shrink-0 items-center justify-center rounded-2xl", toneDeep[tone])}>
      <Icon name={name} size={size * 0.5} />
    </span>
  );
}

export function StartButton({ href, label = "Start", aria }: { href: string; label?: string; aria?: string }) {
  return (
    <Link href={href} aria-label={aria} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition-transform hover:bg-black/80 active:scale-[0.97]">
      {label} <ArrowRight size={14} />
    </Link>
  );
}

export function ScenarioCard({ s, compact = false, onStart }: { s: Scenario; tone?: Tone; compact?: boolean; onStart?: () => void }) {
  const context = scenarioContext(s);
  return (
    <article className={cn("relative isolate flex flex-col justify-between overflow-hidden rounded-card", compact ? "min-h-[160px] gap-3 p-4 text-sm" : "min-h-[240px] gap-4 p-5", context.surface)}>
      <span aria-hidden="true" className={compact ? "pointer-events-none absolute inset-0 opacity-40" : "pointer-events-none absolute inset-0"}><ScenarioArt scenario={s} /></span>
      <div className="relative z-10 min-w-0">
        <p className="mb-2 text-xs font-medium text-charcoal">{context.title}</p>
        <h3 className="max-w-[85%] font-semibold leading-tight">{s.title}</h3>
        <p className="mt-1 text-xs text-charcoal">{s.mode === "free" ? "Free conversation" : s.totalQuestions ? plural(s.totalQuestions, "question") : "Guided questions"}</p>
        {!compact && s.description && <p className="mt-2 max-w-[72%] text-sm text-charcoal">{s.description}</p>}
      </div>
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm text-charcoal">
          {s.minutes !== null && <><Clock size={14} /> {s.minutes} min</>}
          {s.level && <Pill>{s.level}</Pill>}
        </span>
        {onStart
          ? <button type="button" onClick={onStart} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Start <ArrowRight size={14} /></button>
          : <StartButton href={startHref(s.id)} label="Practice" aria={`Practice: ${s.title}`} />}
      </div>
      {!onStart && <Link href={startHref(s.id, "interview")} aria-label={`Real interview: ${s.title}`} className="relative z-10 -mb-2 inline-flex min-h-11 items-center self-start text-sm font-medium text-ink underline underline-offset-2">
        Real interview
      </Link>}
    </article>
  );
}

/** Opens a session: the conversation, or its report once it is finished. */
export const sessionHref = (s: SessionSummary) =>
  `/ai-chat?sessionId=${encodeURIComponent(s.id)}&scenarioId=${encodeURIComponent(s.scenarioId)}`;

function answered(s: SessionSummary) {
  return s.totalQuestions === null ? plural(s.answered, "answer") : `${s.answered}/${s.totalQuestions} ${s.totalQuestions === 1 ? "answer" : "answers"}`;
}

/** The student's sessions from GET /me/sessions. `actions` adds "Continue" (unfinished) or "Practice again" (finished). */
export function SessionList({ sessions, actions }: { sessions: SessionSummary[]; actions?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center gap-3 py-3">
          <div className="min-w-0 flex-1">
            <Link href={sessionHref(s)} title={s.title} className="flex min-h-11 items-center font-medium hover:underline"><span className="truncate">{s.title}</span></Link>
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
