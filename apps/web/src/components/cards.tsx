"use client";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { Icon } from "@/lib/icons";
import { AvatarStack, Pill, Skeleton, toneBg, toneDeep, type Tone } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/features/practice/types/practice";
import type { GroupSummary } from "@/features/groups/types/groups";
import { useToggleMembership } from "@/features/groups/hooks/useGroups";

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
        <IconBadge name={s.id} tone={tone} />
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{s.title}</h3>
          <p className="text-sm text-muted">{s.mode === "free" ? "Free conversation" : "Guided questions"}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        {s.minutes !== null ? (
          <span className="flex items-center gap-2 text-sm text-muted"><Clock size={14} /> {s.minutes} min</span>
        ) : <span />}
        <StartButton href={startHref(s.id)} />
      </div>
    </article>
  );
}

export function JoinButton({ group, className }: { group: GroupSummary; className?: string }) {
  const m = useToggleMembership();
  const pending = m.isPending;
  return (
    <button
      disabled={pending}
      onClick={(e) => { e.preventDefault(); m.mutate({ id: group.id, join: !group.isMember }); }}
      className={cn("rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-60",
        group.isMember ? "bg-ink text-white" : "bg-white text-ink hover:bg-white/80", className)}
    >
      {group.isMember ? "Joined" : "Join"}
    </button>
  );
}

export function GroupCard({ g, tone, small }: { g: GroupSummary; tone: Tone; small?: boolean }) {
  return (
    <article className={cn("relative flex flex-col gap-2 rounded-card p-4", toneBg[tone], small ? "" : "min-h-[200px]")}>
      <Link href={`/groups/${g.id}`} className="absolute inset-0 rounded-card" aria-label={g.name} />
      <div className="flex items-start justify-between">
        <AvatarStack people={g.memberAvatars} size={small ? 30 : 36} />
        {!small && <Pill>{g.memberCount} members</Pill>}
      </div>
      <h3 className={cn("font-semibold", small ? "text-base" : "text-lg")}>{g.name}</h3>
      {small ? <p className="text-xs text-muted">{g.memberCount} members</p> : (
        <>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            {g.language.flagUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={g.language.flagUrl} alt="" className="h-4 w-5 rounded-sm object-cover" />}
            {g.language.name} • {g.levelRange}
          </p>
          <p className="text-sm text-muted">{g.description}</p>
        </>
      )}
      <div className="mt-auto flex items-end justify-between gap-2 pt-2">
        <div className="flex flex-wrap gap-1.5">{!small && g.tags.slice(0, 2).map((t) => <Pill key={t} className="border border-line">{t}</Pill>)}</div>
        <div className="relative z-10"><JoinButton group={g} /></div>
      </div>
    </article>
  );
}

export const CardsSkeleton = ({ n = 4, h = "h-40", cols = "md:grid-cols-2" }: { n?: number; h?: string; cols?: string }) => (
  <div className={cn("grid gap-4", cols)}>{Array.from({ length: n }).map((_, i) => <Skeleton key={i} className={h} />)}</div>
);
