"use client";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useProgress } from "@/features/progress/hooks/useProgress";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";

const labels = [
  ["mistakes_per_100", "Mistakes per 100 words"],
  ["words_per_answer", "Words per answer"],
  ["hesitations_per_min", "Hesitations per minute"],
  ["speaking_seconds", "Speaking seconds"],
] as const;

export default function ProgressPage() {
  const { user } = useCurrentUser();
  const q = useProgress();

  return (
    <div>
      <PageHeader
        eyebrow={user?.firstName ? `Salam ${user.firstName}` : undefined}
        title="Track your progress"
        subtitle="See your speaking metrics and the mistakes to work on next."
      />
      {q.isLoading ? <Skeleton className="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? (
        <EmptyState title="No progress yet" text="Your progress will appear after your first practice session." />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {labels.map(([key, label]) => (
              <Card key={key}>
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-3 text-4xl font-semibold">{q.data.current[key]}</p>
                {q.data.baseline && <p className="mt-2 text-sm text-muted">Baseline: {q.data.baseline[key]}</p>}
              </Card>
            ))}
          </div>
          <Card>
            <h2 className="text-xl font-semibold">Top mistakes</h2>
            {q.data.top_mistakes.length === 0 ? (
              <EmptyState className="mt-4" title="No mistakes yet" text="Complete a practice session to start tracking corrections." />
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {q.data.top_mistakes.map((mistake, index) => (
                  <li key={index} className="py-3 text-sm">
                    {Object.entries(mistake).map(([name, value]) => <span key={name} className="mr-4"><strong>{name}:</strong> {String(value)}</span>)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
