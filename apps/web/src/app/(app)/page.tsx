"use client";
import Link from "next/link";
import { ArrowRight, ChartNoAxesColumn, Flame } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useProgress } from "@/features/progress/hooks/useProgress";
import { mistakeLabel, type Progress } from "@/features/progress/types/progress";
import { useMySessions, useScenarios } from "@/features/practice/hooks/usePractice";
import { Async, Card, EmptyState, GoalHint, PageHeader, ProgressRing, SectionTitle, Skeleton } from "@/components/ui";
import { CardsSkeleton, ScenarioCard, SessionList } from "@/components/cards";
import { groupSituations } from "@/features/plan/lib/plan";
import { usePlanOrder } from "@/features/plan/usePlanOrder";
import type { Scenario } from "@/features/practice/types/practice";
import { Icon } from "@/lib/icons";
import { cn, formatMinutes, formatNumber, plural } from "@/lib/utils";
import PhraseOfTheDay from "@/features/phrase-of-day/components/PhraseOfTheDay";

export default function HomePage() {
  const { user } = useCurrentUser();
  const progress = useProgress();
  const goal = user?.dailyGoalMinutes;

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <PageHeader
          eyebrow={user && <>Salam{user.firstName && user.firstName !== "Guest" ? ` ${user.firstName}` : ""}{user.level ? ` · ${user.level}` : ""}</>}
          title={goal ? `Ready for ${goal} minutes of speaking?` : "Ready to speak?"}
          subtitle="A little practice today makes a big difference. Choose a situation, or continue your journey."
        />

        <Async query={progress} skeleton={<CardsSkeleton n={3} h="h-28" cols="md:grid-cols-3" />}>
          {(p) => <StatCards p={p} />}
        </Async>

        <div className="mt-8">
          <SectionTitle title="Practice a real situation" action={<Link href="/practice" className="inline-flex min-h-11 items-center gap-1">View all scenarios <ArrowRight size={14} /></Link>} />
          <Async
            query={useScenarios()}
            skeleton={<CardsSkeleton />}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No scenarios available" text="Practice scenarios for your language will appear here." />}
          >
            {(list) => <HomeScenarios list={list} />}
          </Async>
        </div>

      </div>

      <aside className="space-y-5">
        <PhraseOfTheDay />
        <TopMistakesCard />
        <DailyGoalCard />
        <RecentSessionsCard />
      </aside>
    </div>
  );
}

function HomeScenarios({ list }: { list: Scenario[] }) {
  const { list: ordered, hasPlan } = usePlanOrder(list);
  // Same order as the Practice page: interviews and exams first unless the plan starts with an everyday scene.
  const shown = groupSituations(ordered, hasPlan).flatMap((g) => g.list).filter((s) => s.mode === "guided").slice(0, 4);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Real situations only (free talk is on the practice page). */}
      {shown.map((s) => <ScenarioCard key={s.id} s={s} />)}
    </div>
  );
}

function StatCards({ p }: { p: Progress }) {
  const mistakes = p.current.mistakesPer100;
  const change = p.mistakesChange;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
      <div className="col-span-2 rounded-card bg-ink p-5 text-white md:col-span-1">
        <p className="text-sm text-white/70">Mistakes per 100 words</p>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-5xl font-extrabold">{formatNumber(mistakes)}</span>
          {change !== null && (
            <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", change <= 0 ? "bg-good-bg text-good" : "bg-bad-bg text-bad")}>
              {change > 0 ? "+" : ""}{formatNumber(change)} {change <= 0 ? "better" : "worse"}
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-white/70">
          {mistakes === null ? "Finish a session to see this number" : change === null ? "No comparison yet" : "Since your first sessions"}
        </p>
      </div>
      <div className="rounded-card bg-tint-visa p-4 md:p-5">
        <p className="text-sm text-slate">Practice this week</p>
        <div className="mt-2 flex items-end justify-between">
          <span className="text-3xl font-extrabold md:text-4xl">{formatMinutes(p.weekSpeakingSeconds / 60)}</span>
          <ChartNoAxesColumn className="text-success" size={32} aria-hidden />
        </div>
      </div>
      <div className="rounded-card bg-tint-campus p-4 md:p-5">
        <p className="text-sm text-slate">Streak</p>
        <div className="mt-2 flex items-end justify-between">
          <span className="text-3xl font-extrabold md:text-4xl">{plural(p.streakDays, "day")}</span>
          <Flame className="text-orange-500" size={32} aria-hidden />
        </div>
      </div>
    </div>
  );
}

function DailyGoalCard() {
  const q = useProgress();
  return (
    <Card>
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Today's goal</h2><span className="text-sm text-muted">Keep going!</span></div>
      <Async query={q} skeleton={<Skeleton className="mt-4 h-36" />}>
        {(p) => {
          const goal = Math.round(p.dailyGoalSeconds / 60);
          const done = Math.floor(p.todaySpeakingSeconds / 60);
          return (
            <>
              <div className="my-4 flex items-center gap-5">
                <ProgressRing value={p.todaySpeakingSeconds} max={p.dailyGoalSeconds} size={112}>
                  <Icon name="target" size={24} />
                </ProgressRing>
                <div>
                  <p className="text-2xl font-semibold">{done} / {goal} min</p>
                  <p className="text-muted">Practice today</p>
                </div>
              </div>
              <GoalHint goal={goal} done={done} />
            </>
          );
        }}
      </Async>
    </Card>
  );
}

function TopMistakesCard() {
  const q = useProgress();
  return (
    <Card>
      <h2 className="text-lg font-semibold">Your top mistakes</h2>
      <p className="mb-3 text-sm text-muted">From your last 5 sessions</p>
      <Async
        query={q}
        skeleton={<div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        isEmpty={(p) => p.topMistakes.length === 0}
        empty={<EmptyState title="No mistakes yet" text="Complete your first practice session to start tracking your mistakes." />}
      >
        {(p) => (
          <>
            <ul className="divide-y divide-line">
              {p.topMistakes.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div><p className="font-medium">{mistakeLabel(m.category)}</p><p className="text-sm text-muted">{m.original} → {m.correction}</p></div>
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-[13px] font-medium">{m.count}×</span>
                </li>
              ))}
            </ul>
            <Link href="/practice" className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-white hover:bg-black/80">Choose a situation to practice <ArrowRight size={14} /></Link>
          </>
        )}
      </Async>
    </Card>
  );
}

function RecentSessionsCard() {
  const q = useMySessions(5);
  return (
    <Card>
      <h2 className="text-lg font-semibold">Recent sessions</h2>
      <Async
        query={q}
        skeleton={<Skeleton className="mt-3 h-32" />}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState className="mt-3" title="No sessions yet" text="Pick a situation and start speaking." />}
      >
        {(list) => <SessionList sessions={list} actions />}
      </Async>
    </Card>
  );
}
