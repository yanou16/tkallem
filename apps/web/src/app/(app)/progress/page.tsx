"use client";
import Link from "next/link";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useProgress } from "@/features/progress/hooks/useProgress";
import { mistakeLabel, type ProgressMetrics } from "@/features/progress/types/progress";
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { formatMinutes, formatNumber } from "@/lib/utils";

type Metric = {
  key: keyof ProgressMetrics;
  label: string;
  /** Which way is better, said in words (it differs from one metric to the next). */
  better: string;
  format?: (value: number) => string;
};

const MISTAKES: Metric = { key: "mistakesPer100", label: "Mistakes per 100 words", better: "Lower is better" };
const OTHERS: Metric[] = [
  { key: "wordsPerAnswer", label: "Words per answer", better: "Higher is better" },
  { key: "hesitationsPerMin", label: "Hesitations per minute", better: "Lower is better" },
  { key: "speakingSeconds", label: "Speaking time per session", better: "Higher is better", format: (s) => formatMinutes(s / 60) },
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
      {q.isLoading ? <Skeleton className="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !p ? (
        <EmptyState title="No progress yet" text="Finish a practice session and your numbers will appear here."
          action={<Link href="/practice" className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Choose a situation</Link>} />
      ) : p.current[MISTAKES.key] === null && p.current.wordsPerAnswer === null ? (
        <EmptyState title="Your numbers start with your first session" text="Answer the questions of one situation, then come back: you will see your mistakes, your words per answer and what to work on."
          action={<Link href="/practice" className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Choose a situation</Link>} />
      ) : (
        <div className="space-y-6">
          {!p.baseline && <p className="text-sm text-slate">This is your starting point. The comparison with your first sessions appears after your next one.</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-card bg-ink p-5 text-white md:row-span-1">
              <p className="text-sm text-white/80">{MISTAKES.label}</p>
              <p className="mt-2 text-5xl font-medium">{show(MISTAKES, p.current[MISTAKES.key])}</p>
              <p className="mt-2 text-sm text-white/80">{MISTAKES.better}</p>
              {p.mistakesChange !== null && <p className="mt-2 font-medium">{changeText(p.mistakesChange)}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {OTHERS.filter((m) => p.current[m.key] !== null).map((metric) => (
                <Card key={metric.key}>
                  <p className="text-sm text-slate">{metric.label}</p>
                  <p className="mt-1 text-3xl font-medium">{show(metric, p.current[metric.key])}</p>
                  <p className="mt-1 text-sm text-slate">
                    {metric.better}{p.baseline ? ` · first sessions: ${show(metric, p.baseline[metric.key])}` : ""}
                  </p>
                </Card>
              ))}
            </div>
          </div>
          {(p.current.hesitationsPerMin === null || p.current.speakingSeconds === null) && (
            <p className="text-sm text-slate">Answer out loud in a session to see your hesitations and your speaking time.</p>
          )}
          <Card>
            <h2 className="text-xl font-semibold">Top mistakes</h2>
            <p className="text-sm text-slate">From your last 5 sessions</p>
            {p.topMistakes.length === 0 ? (
              <EmptyState className="mt-4" title="No corrections yet" text="Finish a practice session to see which mistakes come back most often."
                action={<Link href="/practice" className="inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-5 text-sm font-semibold">Choose a situation</Link>} />
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {p.topMistakes.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <p className="font-medium">{mistakeLabel(m.category)}</p>
                      <p className="text-sm text-slate">{m.original} → {m.correction}</p>
                    </div>
                    <span aria-label={`${m.count} times`} className="rounded-full bg-surface px-2.5 py-1 text-[13px] font-semibold">{m.count}×</span>
                  </li>
                ))}
              </ul>
            )}
            {p.topMistakes.length > 0 && (
              <Link href="/practice" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-hairline-strong px-5 text-sm font-semibold hover:bg-surface">Practice again</Link>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
