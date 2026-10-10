"use client";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useMySessions, useScenarios } from "@/features/practice/hooks/usePractice";
import { Async, Card, EmptyState, PageHeader, SectionTitle, Skeleton, toneAt } from "@/components/ui";
import { CardsSkeleton, ScenarioCard, SessionList } from "@/components/cards";

export default function PracticePage() {
  const { user } = useCurrentUser();
  const all = useScenarios();
  const recent = useMySessions(5);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div>
        <PageHeader
          eyebrow={user?.level ? `Practice · ${user.level}` : "Practice"}
          title="Choose your next practice"
          subtitle="Real-life conversations, structured exercises, and exam preparation — all in one place."
        />

        <SectionTitle title="All practice scenarios" />
        <Async query={all} skeleton={<CardsSkeleton n={4} h="h-48" cols="md:grid-cols-2 2xl:grid-cols-4" />}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="No scenarios yet" text="Scenarios for your learning language will appear here." />}>
          {(list) => (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {list.map((s, i) => <ScenarioCard key={s.id} s={s} tone={toneAt(i)} />)}
            </div>
          )}
        </Async>
      </div>

      <aside className="space-y-5">
        <Card>
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          {/* TODO: GET /sessions/{id} to continue an unfinished session instead of starting the scenario again. */}
          <p className="mb-2 text-sm text-muted">Practice the same situation again.</p>
          <Async query={recent} skeleton={<Skeleton className="h-40" />} isEmpty={(d) => d.length === 0}
            empty={<EmptyState title="No sessions yet" text="Start a scenario. Your sessions will show up here." />}>
            {(list) => <SessionList sessions={list} restart />}
          </Async>
        </Card>
        {/* TODO: "Recommended for you" and "Today's focus" need API routes (recommendations, weak points). */}
      </aside>
    </div>
  );
}
