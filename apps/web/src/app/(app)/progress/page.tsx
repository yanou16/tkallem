"use client";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useProgress } from "@/features/progress/hooks/useProgress";
import { MISTAKE_LABELS, type ProgressMetrics } from "@/features/progress/types/progress";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { formatMinutes, formatNumber } from "@/lib/utils";

type Metric = {
  key: keyof ProgressMetrics;
  label: string;
  /** Why the value can be missing. */
  missing: string;
  format?: (value: number) => string;
};

const METRICS: Metric[] = [
  { key: "mistakesPer100", label: "Mistakes per 100 words", missing: "Finish a session to see this" },
  { key: "wordsPerAnswer", label: "Words per answer", missing: "Finish a session to see this" },
  { key: "hesitationsPerMin", label: "Hesitations per minute", missing: "Voice sessions only" },
  { key: "speakingSeconds", label: "Speaking time per session", missing: "Voice sessions only", format: (s) => formatMinutes(s / 60) },
];

const show = (metric: Metric, value: number | null) =>
  value === null ? "—" : metric.format ? metric.format(value) : formatNumber(value);

function changeText(change: number) {
  const amount = formatNumber(Math.abs(change));
  if (amount === "0") return "Same as in your first sessions";
  return change < 0 ? `${amount} fewer than in your first sessions` : `${amount} more than in your first sessions`;
}

export default function ProgressPage() {
  const { user } = useCurrentUser();
  const q = useProgress();
  const p = q.data;

  return (
    <div>
      <PageHeader
        eyebrow={user?.firstName ? `Salam ${user.firstName}` : undefined}
        title="Track your progress"
        subtitle="See your speaking metrics and the mistakes to work on next."
      />
      {q.isLoading ? <Skeleton className="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !p ? null : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {METRICS.map((metric) => {
              const value = p.current[metric.key];
              return (
                <Card key={metric.key}>
                  <p className="text-sm text-muted">{metric.label}</p>
                  <p className="mt-3 text-4xl font-semibold">{show(metric, value)}</p>
                  {value === null && <p className="mt-1 text-sm text-muted">{metric.missing}</p>}
                  {metric.key === "mistakesPer100" && p.mistakesChange !== null && (
                    <p className="mt-2 text-sm font-medium">{changeText(p.mistakesChange)}</p>
                  )}
                  <p className="mt-2 text-sm text-muted">
                    {p.baseline ? `First sessions: ${show(metric, p.baseline[metric.key])}` : "No comparison yet"}
                  </p>
                </Card>
              );
            })}
          </div>
          <Card>
            <h2 className="text-xl font-semibold">Top mistakes</h2>
            <p className="text-sm text-muted">From your last 5 sessions</p>
            {p.topMistakes.length === 0 ? (
              <EmptyState className="mt-4" title="No mistakes yet" text="Complete a practice session to start tracking corrections." />
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {p.topMistakes.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium">{MISTAKE_LABELS[m.category] ?? m.category}</p>
                      <p className="text-sm text-muted">{m.original} → {m.correction}</p>
                    </div>
                    <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium">{m.count}×</span>
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
