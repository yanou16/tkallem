"use client";
import Link from "next/link";
import { ScenarioArt, scenarioContext } from "./ScenarioArt";
import { ArrowRight, Clock } from "lucide-react";
import { Icon } from "@/lib/icons";
import { Pill, Skeleton, toneBg, toneDeep, type Tone } from "@/components/ui";
import { cn, plural, timeAgo } from "@/lib/utils";
import type { Scenario, SessionSummary } from "@/features/practice/types/practice";
import type { GroupSummary } from "@/features/groups/types/groups";

export const startHref = (scenarioId: string) => `/ai-chat?scenarioId=${encodeURIComponent(scenarioId)}`;

export function IconBadge({ name, tone, size = 44 }: { name?: string; tone: Tone; size?: number }) {
  return (
    <span style={{ width: size, height: size }} className={cn("flex shrink-0 items-center justify-center rounded-2xl", toneDeep[tone])}>
      <Icon name={name} size={size * 0.5} />
    </span>
  );
}

export function StartButton({ href, label = "Start" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black/80">
      {label} <ArrowRight size={14} />
    </Link>
  );
}

export function ScenarioCard({ s }: { s: Scenario; tone?: Tone }) {
  const context = scenarioContext(s);
  return (
    <article className={cn("relative isolate flex min-h-[240px] flex-col justify-between gap-4 overflow-hidden rounded-card p-5", context.surface)}>
      <ScenarioArt scenario={s} />
      <div className="relative z-10 min-w-0">
        <p className="mb-2 text-xs font-medium text-charcoal">{context.title}</p>
        <h3 className="max-w-[85%] font-semibold leading-tight">{s.title}</h3>
        <p className="mt-1 text-xs text-charcoal">{s.mode === "free" ? "Free conversation" : s.totalQuestions ? plural(s.totalQuestions, "question") : "Guided questions"}</p>
        {s.description && <p className="mt-2 max-w-[72%] text-sm text-charcoal">{s.description}</p>}
      </div>
      <div className="relative z-10 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm text-charcoal">
          {s.minutes !== null && <><Clock size={14} /> {s.minutes} min</>}
          {s.level && <Pill>{s.level}</Pill>}
        </span>
        <StartButton href={startHref(s.id)} />
      </div>
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

/** Recommendations use the public group preview; joining is handled by the actual group page. */
export function GroupCard({ g, tone }: { g: GroupSummary; tone: Tone; small?: boolean }) {
  return (
    <Link href="/groups" className={cn("flex flex-col gap-2 rounded-card p-4", toneBg[tone])}>
      <h3 className="font-semibold">{g.name}</h3>
      <p className="text-sm text-muted">{plural(g.memberCount, "member")} · {g.level}</p>
      <p className="text-sm">{g.theme.title}</p>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold">View group <ArrowRight size={14} /></span>
    </Link>
  );
}

export const CardsSkeleton = ({ n = 4, h = "h-40", cols = "md:grid-cols-2" }: { n?: number; h?: string; cols?: string }) => (
  <div className={cn("grid gap-4", cols)}>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={h} />)}</div>
);
