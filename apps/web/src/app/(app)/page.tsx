"use client";
import Link from "next/link";
import { ArrowRight, ChartNoAxesColumn, Flame } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useDashboard, useTopMistakes } from "@/features/dashboard/hooks/useDashboard";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { useSuggestedGroups } from "@/features/groups/hooks/useGroups";
import { Async, Button, Card, EmptyState, GoalHint, PageHeader, ProgressRing, SectionTitle, Skeleton, toneAt } from "@/components/ui";
import { CardsSkeleton, GroupCard, ScenarioCard } from "@/components/cards";
import { Icon } from "@/lib/icons";
import { cn, plural } from "@/lib/utils";

export default function HomePage() {
  const { user, activeLanguage } = useCurrentUser();
  const dash = useDashboard();
  const goal = dash.data?.dailyGoalMinutes ?? user?.dailyGoalMinutes;

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <PageHeader
          eyebrow={user && <>Salam {user.firstName}{activeLanguage?.level ? ` · ${activeLanguage.level}` : ""}</>}
          title={goal ? `Ready for ${goal} minutes of speaking?` : "Ready to speak?"}
          subtitle="A little practice today makes a big difference. Choose a situation, or continue your journey."
        />

        <Async
          query={dash}
          skeleton={<CardsSkeleton n={3} h="h-28" cols="md:grid-cols-3" />}
          empty={<EmptyState title="No stats yet" text="Complete your first practice session to start tracking your progress." />}
        >
          {(d) => (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-card bg-ink p-5 text-white">
                <p className="text-sm text-white/70">Mistakes per 100 words</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-5xl font-extrabold">{d.mistakesPer100Words}</span>
                  <span className={cn("rounded-full px-3 py-1 text-sm font-semibold", d.mistakesChange <= 0 ? "bg-success" : "bg-red-500")}>
                    {d.mistakesChange > 0 ? "+" : ""}{d.mistakesChange}{d.mistakesChangeLabel ? ` ${d.mistakesChangeLabel}` : ""}
                  </span>
                </div>
              </div>
              <div className="rounded-card bg-mint p-5">
                <p className="text-sm text-muted">Speaking this week</p>
                <div className="mt-2 flex items-end justify-between">
                  <span className="text-4xl font-extrabold">{d.speakingMinutesThisWeek} min</span>
                  <ChartNoAxesColumn className="text-success" size={36} />
                </div>
              </div>
              <div className="rounded-card bg-butter p-5">
                <p className="text-sm text-muted">Streak</p>
                <div className="mt-2 flex items-end justify-between">
                  <span className="text-4xl font-extrabold">{plural(d.streakDays, "day")}</span>
                  <Flame className="text-orange-500" size={36} />
                </div>
              </div>
            </div>
          )}
        </Async>

        <div className="mt-8">
          <SectionTitle title="Practice a real situation" action={<Link href="/practice" className="inline-flex items-center gap-1">View all scenarios <ArrowRight size={14} /></Link>} />
          <Async
            query={useScenarios()}
            skeleton={<CardsSkeleton />}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No scenarios available" text="Practice scenarios for your language will appear here." />}
          >
            {(list) => (
              <div className="grid gap-4 md:grid-cols-2">
                {list.slice(0, 4).map((s, i) => <ScenarioCard key={s.id} s={s} tone={toneAt(i)} />)}
              </div>
            )}
          </Async>
        </div>

        <div className="mt-8">
          <SectionTitle title="Recommended groups" action={<Link href="/groups" className="inline-flex items-center gap-1">Explore all groups <ArrowRight size={14} /></Link>} />
          <Async
            query={useSuggestedGroups()}
            skeleton={<CardsSkeleton n={3} h="h-32" cols="md:grid-cols-3" />}
            isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No groups to suggest yet" text="Join a community to start practicing with other learners." action={<Link href="/groups"><Button>Browse groups</Button></Link>} />}
          >
            {(list) => <div className="grid gap-4 md:grid-cols-3">{list.slice(0, 3).map((g, i) => <GroupCard key={g.id} g={g} tone={toneAt(i)} small />)}</div>}
          </Async>
        </div>
      </div>

      <aside className="space-y-5">
        <TopMistakesCard />
        <Card>
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Today's goal</h2><span className="text-sm text-muted">Keep going!</span></div>
          {dash.isLoading ? <Skeleton className="mt-4 h-36" /> : dash.data ? (
            <>
              <div className="my-4 flex items-center gap-5">
                <ProgressRing value={dash.data.dailyCompletedMinutes} max={dash.data.dailyGoalMinutes} size={112}>
                  <Icon name="target" size={24} />
                </ProgressRing>
                <div>
                  <p className="text-2xl font-bold">{dash.data.dailyCompletedMinutes} / {dash.data.dailyGoalMinutes} min</p>
                  <p className="text-muted">Speaking practice</p>
                </div>
              </div>
              <GoalHint goal={dash.data.dailyGoalMinutes} done={dash.data.dailyCompletedMinutes} />
            </>
          ) : <EmptyState className="mt-3" title="No goal set" text="Set a daily goal in your profile." />}
        </Card>
      </aside>
    </div>
  );
}

function TopMistakesCard() {
  const q = useTopMistakes();
  return (
    <Card>
      <h2 className="text-lg font-semibold">Your top mistakes</h2>
      <p className="mb-3 text-sm text-muted">From your last 5 sessions</p>
      <Async
        query={q}
        skeleton={<div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState title="No mistakes yet" text="Complete your first practice session to start tracking your mistakes." />}
      >
        {(list) => (
          <>
            <ul className="divide-y divide-line">
              {list.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div><p className="font-medium">{m.category}</p><p className="text-sm text-muted">{m.original} → {m.correction}</p></div>
                  <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium">{m.count}×</span>
                </li>
              ))}
            </ul>
            <Link href="/practice" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-white">Practice my weak points <ArrowRight size={14} /></Link>
          </>
        )}
      </Async>
    </Card>
  );
}
