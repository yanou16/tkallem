"use client";
import Link from "next/link";
import { ArrowRight, AudioLines, ClipboardCheck, FileWarning, MessageCircle, Mic } from "lucide-react";
import { useProgress } from "@/features/progress/hooks/useProgress";
import { mistakeLabel, type ProgressMetrics } from "@/features/progress/types/progress";
import { Card, ErrorState, Skeleton } from "@/components/ui";
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
  const q = useProgress();
  const p = q.data;

  const comparison = (metric: Metric) => {
    const baseline = p?.baseline?.[metric.key];
    return baseline == null ? "No comparison yet" : `First sessions: ${show(metric, baseline)}`;
  };

  return (
    <div className="mx-auto w-full max-w-[1160px] pb-6">
      <header className="mb-7 sm:mb-9">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">Your learning snapshot</p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl xl:text-5xl">Small steps. Real progress.</h1>
        <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">Your speaking metrics and what to work on next.</p>
      </header>
      {q.isLoading ? <Skeleton className="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !p ? null : (
        <div className="space-y-5 sm:space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {METRICS.slice(0, 2).map((metric, index) => {
              const value = p.current[metric.key];
              const Illustration = index === 0 ? FileWarning : MessageCircle;
              return (
                <section key={metric.key} aria-label={metric.label} className={`relative overflow-hidden rounded-card p-6 sm:p-7 ${index === 0 ? "bg-mint/70" : "bg-butter/70"}`}>
                  <div className="relative z-10 max-w-[75%]">
                    <h2 className="text-sm font-medium text-ink/70 sm:text-base">{metric.label}</h2>
                    <p className="mt-4 text-5xl font-bold tracking-tight sm:text-6xl xl:text-7xl">{show(metric, value)}</p>
                    {value === null && <p className="mt-2 text-sm text-muted">{metric.missing}</p>}
                    {metric.key === "mistakesPer100" && p.mistakesChange !== null && (
                      <p className="mt-3 text-sm font-medium">{changeText(p.mistakesChange)}</p>
                    )}
                    <p className="mt-3 text-sm text-muted">{comparison(metric)}</p>
                  </div>
                  <Illustration aria-hidden="true" strokeWidth={1.1} className={`absolute right-5 top-1/2 h-20 w-20 -translate-y-1/2 sm:right-6 sm:h-24 sm:w-24 ${index === 0 ? "rotate-12 text-[#70A794]" : "-rotate-12 text-[#C89B31]"}`} />
                </section>
              );
            })}
          </div>

          <Card className="p-6 sm:p-7">
            <h2 className="text-lg font-semibold sm:text-xl">Voice practice metrics</h2>
            <p className="mt-1 text-sm text-muted">Based on your spoken answers.</p>
            <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-0 md:divide-x md:divide-line">
              {METRICS.slice(2).map((metric, index) => {
                const value = p.current[metric.key];
                const Icon = index === 0 ? Mic : AudioLines;
                return <div key={metric.key} className={`flex items-center gap-4 ${index === 1 ? "border-t border-line pt-6 md:border-t-0 md:pl-7 md:pt-0" : "md:pr-7"}`}>
                  <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-lilac/60 text-[#8D7DC1]" : "bg-mint/60 text-[#548B78]"}`}><Icon aria-hidden="true" size={32} strokeWidth={1.4} /></span>
                  <div className="min-w-0">
                    <h3 className="text-sm text-ink/70">{metric.label}</h3>
                    <p className="mt-1 text-3xl font-semibold tracking-tight">{show(metric, value)}</p>
                    <p className="mt-1 text-sm text-muted">{value === null ? "Available after a voice session." : comparison(metric)}</p>
                    {value === null && p.baseline?.[metric.key] != null && <p className="mt-1 text-sm text-muted">{comparison(metric)}</p>}
                  </div>
                </div>;
              })}
            </div>
          </Card>

          <Card className="p-6 sm:p-7">
            <h2 className="text-lg font-semibold sm:text-xl">Top mistakes</h2>
            <p className="mt-1 text-sm text-muted">From your last 5 sessions</p>
            {p.topMistakes.length === 0 ? (
              <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-peach/50 text-[#BF8254]"><ClipboardCheck aria-hidden="true" size={45} strokeWidth={1.2} /></span>
                <div className="flex-1">
                  <h3 className="text-base font-semibold">Your next session will tell us more</h3>
                  <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">No corrections to show yet. Complete a practice session to see what to work on next.</p>
                </div>
                <Link href="/practice" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">Go to practice <ArrowRight aria-hidden="true" size={17} /></Link>
              </div>
            ) : (
              <ul className="mt-5 divide-y divide-line">
                {p.topMistakes.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="font-medium">{mistakeLabel(m.category)}</p>
                      <p className="mt-1 break-words text-sm leading-relaxed text-muted"><span className="line-through decoration-ink/30">{m.original}</span> <span aria-label="corrected to">→</span> <span className="font-medium text-ink">{m.correction}</span></p>
                    </div>
                    <span className="shrink-0 rounded-full bg-peach/60 px-3 py-1.5 text-xs font-medium">{m.count}×</span>
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
