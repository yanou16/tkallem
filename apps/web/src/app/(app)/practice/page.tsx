"use client";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useMySessions, useScenarios } from "@/features/practice/hooks/usePractice";
import type { Scenario } from "@/features/practice/types/practice";
import { Async, Card, EmptyState, PageHeader, SectionTitle, Skeleton } from "@/components/ui";
import Link from "next/link";
import { CardsSkeleton, ScenarioCard, SessionList } from "@/components/cards";
import { groupSituations } from "@/features/plan/lib/plan";
import { usePlanOrder } from "@/features/plan/usePlanOrder";

export default function PracticePage() {
  const { user } = useCurrentUser();
  const all = useScenarios();
  const recent = useMySessions(5);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <PageHeader
          eyebrow={user?.level ? `Coach at ${user.level}` : undefined}
          title="Choose your next practice"
          subtitle="Pick a situation. In Practice the coach corrects each answer. In Real interview nothing is shown until the end, like the real one."
        />

        <SectionTitle title="Situations" action={<Link href="/plan" className="inline-flex min-h-11 items-center underline underline-offset-4">Your plan</Link>} />
        <Async query={all} skeleton={<CardsSkeleton n={4} h="h-48" cols="md:grid-cols-2 2xl:grid-cols-4" />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="No scenarios yet" text="Scenarios for your learning language will appear here." />}>
          {(list) => <ScenarioGrid list={list} />}
        </Async>
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <p className="mb-2 text-sm text-muted">Continue where you stopped, or practice the same situation again.</p>
          <Async query={recent} skeleton={<Skeleton className="h-40" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No sessions yet" text="Start a scenario. Your sessions will show up here." />}>
            {(list) => <SessionList sessions={list} actions />}
          </Async>
        </Card>
        {/* TODO: "Recommended for you" and "Today's focus" need API routes (recommendations, weak points). */}
      </aside>
    </div>
  );
}

/** In the order of the student's plan when there is one; the same situations for everyone. */
function ScenarioGrid({ list }: { list: Scenario[] }) {
  const { list: ordered, hasPlan } = usePlanOrder(list);
  const groups = groupSituations(ordered, hasPlan);
  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title}>
          <h2 className="mb-3 text-lg font-semibold">{g.title}</h2>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">{g.list.map((s) => <ScenarioCard key={s.id} s={s} />)}</div>
        </section>
      ))}
    </div>
  );
}
