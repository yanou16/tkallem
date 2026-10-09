"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useProgress } from "@/features/progress/hooks/useProgress";
import type { ProgressData, ProgressRange, StatWithChange } from "@/features/progress/types/progress";
import { Card, EmptyState, ErrorState, GoalHint, PageHeader, ProgressRing, Skeleton, toneAt, toneBg, toneDeep } from "@/components/ui";
import { Icon } from "@/lib/icons";
import { cn, formatMinutes, plural } from "@/lib/utils";

const RANGES: { v: ProgressRange; label: string }[] = [{ v: "4w", label: "Last 4 weeks" }, { v: "8w", label: "Last 8 weeks" }, { v: "12w", label: "Last 12 weeks" }];

export default function ProgressPage() {
  const { user, activeLanguage } = useCurrentUser();
  const [range, setRange] = useState<ProgressRange>("4w");
  const q = useProgress(range);

  return (
    <div>
      <PageHeader eyebrow={user && <>Salam {user.firstName}{activeLanguage?.level ? ` · ${activeLanguage.level}` : ""}</>} title="Track your progress" subtitle="See how far you've come and stay motivated. Every conversation counts!" />
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <EmptyState title="No progress yet" text="Your progress will appear after your first practice session." /> : <Body d={q.data} range={range} setRange={setRange} />}
    </div>
  );
}

function Loading() {
  return <div className="space-y-4"><div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div><Skeleton className="h-72" /></div>;
}

function Stat({ label, icon, tone, value, s, unit, invert }: { label: string; icon: string; tone: number; value: string; s: StatWithChange; unit: string; invert?: boolean }) {
  const good = invert ? s.change <= 0 : s.change >= 0;
  const t = toneAt(tone);
  const txt = `${s.change > 0 ? "+" : ""}${s.change}${s.changeUnit === "percent" ? "%" : ""}`;
  return (
    <div className={cn("rounded-card p-5", toneBg[t])}>
      <div className="flex items-center gap-3"><span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", toneDeep[t])}><Icon name={icon} /></span><p className="font-medium leading-tight text-muted">{label}</p></div>
      <p className="mt-3 text-4xl font-extrabold">{value}</p>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted">
        <span className={cn("inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 font-semibold", good ? "text-emerald-700" : "text-red-600")}>
          {s.change >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{txt}
        </span>{unit}
      </p>
    </div>
  );
}

function Body({ d, range, setRange }: { d: ProgressData; range: ProgressRange; setRange: (r: ProgressRange) => void }) {
  const goalLeft = Math.max(0, d.goal.dailyGoalMinutes - d.goal.completedMinutes);
  const ms = d.nextMilestone;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <Stat label="Speaking time this month" icon="mic" tone={0} value={formatMinutes(d.stats.speakingMinutes.value)} s={d.stats.speakingMinutes} unit="vs last month" />
          <Stat label="Streak" icon="flame" tone={1} value={plural(d.stats.streakDays.value, "day")} s={d.stats.streakDays} unit="vs last month" />
          <Stat label="Lessons completed" icon="book" tone={2} value={String(d.stats.lessonsCompleted.value)} s={d.stats.lessonsCompleted} unit="vs last month" />
          <Stat label="Active weak points" icon="warning" tone={3} value={String(d.stats.weakPoints.value)} s={d.stats.weakPoints} unit="vs last month" invert />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-start justify-between">
              <div><h2 className="text-lg font-semibold">Speaking time</h2><p className="text-sm text-muted">Minutes spent speaking each week</p></div>
              <label className="flex items-center gap-1 text-sm text-muted">
                <select aria-label="Range" value={range} onChange={(e) => setRange(e.target.value as ProgressRange)} className="bg-transparent outline-none">{RANGES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select><ChevronDown size={14} />
              </label>
            </div>
            {d.speakingTime.length === 0 ? <EmptyState className="mt-4" title="No speaking history" text="Your progress will appear after your first practice session." /> : <LineChart data={d.speakingTime} />}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Skill areas</h2><p className="text-sm text-muted">Your current level by category</p>
            {d.skills.length === 0 ? <EmptyState className="mt-4" title="No skill data yet" text="Skill levels appear after a few sessions." /> : (
              <div className="mt-4 flex h-56 items-end justify-around gap-3">
                {d.skills.map((s, i) => (
                  <div key={s.key} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-sm font-semibold">{s.percent}%</span>
                    <div className={cn("w-full max-w-[64px] rounded-t-xl", toneDeep[toneAt(i)])} style={{ height: `${Math.max(8, s.percent) * 1.4}px` }} />
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-soft"><Icon name={s.icon ?? s.key} size={16} /></span>
                    <span className="text-xs font-medium">{s.label}</span><span className="-mt-1 text-xs text-muted">{s.level}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <div className="flex justify-between"><div><h2 className="text-lg font-semibold">Mistake Memory</h2><p className="text-sm text-muted">Your most common error categories</p></div><Link href="/practice" className="inline-flex items-center gap-1 text-sm text-muted">View all <ArrowRight size={14} /></Link></div>
            {d.mistakes.length === 0 ? <EmptyState className="mt-3" title="No mistakes yet" text="Complete your first practice session to start tracking your mistakes." /> : (
              <ul className="mt-3 divide-y divide-line">{d.mistakes.slice(0, 5).map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-full font-medium", toneBg[toneAt(i + 3)])}>{i + 1}</span>
                  <span className="w-24 font-medium">{m.category}</span><span className="flex-1 truncate text-muted">{m.original} → {m.correction}</span>
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs">{m.count}x</span>
                </li>))}</ul>
            )}
          </Card>
          <Card>
            <div className="flex justify-between"><div><h2 className="text-lg font-semibold">Vocabulary learned</h2><p className="text-sm text-muted">New words from your conversations</p></div></div>
            {d.vocabulary.length === 0 ? <EmptyState className="mt-3" title="No words yet" text="New words from your conversations will show up here." /> : (
              <ul className="mt-3 divide-y divide-line">{d.vocabulary.slice(0, 5).map((v, i) => (
                <li key={v.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", toneBg[toneAt(i)])}><Icon name={v.icon ?? "book"} size={15} /></span>
                  <span className="w-28 font-medium">{v.word}</span><span className="flex-1 truncate text-muted">{v.category}</span>
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs">{v.count}x</span>
                </li>))}</ul>
            )}
          </Card>
          <Card>
            <h2 className="text-lg font-semibold">Recent improvements</h2><p className="text-sm text-muted">Areas where you've made progress</p>
            {d.recentImprovements.length === 0 ? <EmptyState className="mt-3" title="Nothing to show yet" text="Improvements appear as you keep practicing." /> : (
              <ul className="mt-3 space-y-3">{d.recentImprovements.slice(0, 4).map((r, i) => (
                <li key={r.id} className="flex items-center gap-3 text-sm">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneBg[toneAt(i)])}><Icon name={r.icon ?? "chart"} size={18} /></span>
                  <div className="flex-1"><p className="font-semibold">{r.label}</p><p className="text-muted">{r.description}</p></div>
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-emerald-700">+{r.changePercent}%</span>
                </li>))}</ul>
            )}
          </Card>
        </div>
      </div>

      <aside className="space-y-5">
        <Card>
          <div className="flex justify-between"><h2 className="text-lg font-semibold">Goal progress</h2><Link href="/profile" className="text-sm text-muted">Edit goal</Link></div>
          <div className="my-5 flex items-center gap-5">
            <ProgressRing value={d.goal.completedMinutes} max={d.goal.dailyGoalMinutes} size={116} stroke={13}><Icon name="target" size={26} /></ProgressRing>
            <div><p className="text-2xl font-bold">{d.goal.completedMinutes} / {d.goal.dailyGoalMinutes} min</p><p className="text-muted">Daily speaking practice</p></div>
          </div>
          <GoalHint goal={d.goal.dailyGoalMinutes} done={d.goal.completedMinutes} />
          <span className="sr-only">{goalLeft} minutes remaining</span>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Next milestone</h2>
          {!ms ? <EmptyState title="No milestone yet" text="Keep practicing to unlock your next milestone." /> : (() => {
            const pct = ms.targetMinutes ? Math.min(100, Math.round((ms.currentMinutes / ms.targetMinutes) * 100)) : 0;
            return (<>
              <div className="flex items-center gap-4"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-butter"><Icon name="trophy" size={26} /></span><p className="text-lg">{ms.title}</p></div>
              <div className="mt-4 h-2.5 rounded-full bg-black/10"><div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} /></div>
              <p className="mt-2 flex justify-between text-sm text-muted"><span>{formatMinutes(ms.currentMinutes)} / {formatMinutes(ms.targetMinutes)}</span><span>{pct}%</span></p>
              <Link href="/practice" className="mt-5 flex items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-sm font-semibold text-white">Generate practice plan <ArrowRight size={14} /></Link>
            </>);
          })()}
        </Card>
      </aside>
    </div>
  );
}

function LineChart({ data }: { data: { label: string; minutes: number }[] }) {
  const W = 420, H = 220, P = { l: 34, r: 14, t: 16, b: 28 };
  const max = Math.max(10, Math.ceil(Math.max(...data.map((d) => d.minutes)) / 30) * 30);
  const x = (i: number) => P.l + (data.length === 1 ? (W - P.l - P.r) / 2 : (i / (data.length - 1)) * (W - P.l - P.r));
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const pts = data.map((d, i) => `${x(i)},${y(d.minutes)}`);
  const area = `M${x(0)},${H - P.b} L${pts.join(" L")} L${x(data.length - 1)},${H - P.b} Z`;
  const ticks = [0, max / 3, (max / 3) * 2, max].map(Math.round);
  const last = data[data.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Speaking minutes per week">
      {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#ececf0" /><text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b6b76">{t}</text></g>)}
      <path d={area} fill="#1DB87E" opacity={0.12} />
      <polyline points={pts.join(" ")} fill="none" stroke="#1DB87E" strokeWidth={2.5} strokeLinejoin="round" />
      {data.map((d, i) => <g key={i}><circle cx={x(i)} cy={y(d.minutes)} r={4} fill="#1DB87E" /><text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b6b76">{d.label}</text></g>)}
      <g transform={`translate(${x(data.length - 1) - 30}, ${y(last.minutes) - 38})`}><rect width="60" height="26" rx="8" fill="#111" /><text x="30" y="17" textAnchor="middle" fontSize="12" fill="#fff">{last.minutes} min</text></g>
    </svg>
  );
}
