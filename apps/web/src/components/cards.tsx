"use client";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Icon } from "@/lib/icons";
import { AvatarStack, Pill, Skeleton, toneBg, toneDeep, type Tone } from "@/components/ui";
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

export function ScenarioCard({ s, tone }: { s: Scenario; tone: Tone }) {
  return (
    <article className={cn("flex flex-col justify-between gap-4 rounded-card p-5", toneBg[tone])}>
      <div className="flex gap-4">
        {/* The API sends no icon yet: lib/icons.tsx maps the scenario id instead. */}
        <IconBadge name={s.icon ?? s.id} tone={tone} />
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{s.title}</h3>
          <p className="text-sm text-muted">
            {s.mode === "free" ? "Free conversation" : s.totalQuestions ? plural(s.totalQuestions, "question") : "Guided questions"}
          </p>
        </div>
      </div>
      {s.description && <p className="text-sm text-muted">{s.description}</p>}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-muted">
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

export function JoinButton({ className }: { group: GroupSummary; className?: string }) {
  return <Link href="/groups" className={cn("rounded-full bg-white px-4 py-2 text-sm font-semibold", className)}>Open groups</Link>;
}

export function GroupCard({ g, tone, small }: { g: GroupSummary; tone: Tone; small?: boolean }) {
  return (
    <article className={cn("relative flex flex-col gap-2 rounded-card p-4", toneBg[tone], small ? "" : "min-h-[200px]")}>
      <Link href={`/groups/${g.id}`} className="absolute inset-0 rounded-card" aria-label={g.name} />
      <div className="flex items-start justify-between">
        <Pill>{g.level}</Pill>
        {!small && <Pill>{g.memberCount} members</Pill>}
      </div>
      <h3 className={cn("font-semibold", small ? "text-base" : "text-lg")}>{g.name}</h3>
      {small ? <p className="text-xs text-muted">{g.memberCount} members</p> : (
        <>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            English • {g.level}
          </p>
          <p className="text-sm text-muted">Practice with learners at your level.</p>
        </>
      )}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="flex flex-wrap gap-1.5">{!small && [g.theme.title].map((t) => <Pill key={t} className="border border-line">{t}</Pill>)}</div>
        <div className="relative z-10"><JoinButton group={g} /></div>
      </div>
    </article>
  );
}

export const CardsSkeleton = ({ n = 4, h = "h-40", cols = "md:grid-cols-2" }: { n?: number; h?: string; cols?: string }) => (
  <div className={cn("grid gap-4", cols)}>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={h} />)}</div>
);
