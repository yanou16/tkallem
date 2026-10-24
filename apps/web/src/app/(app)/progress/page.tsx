"use client";
import Link from "next/link";
import { ArrowRight, AudioLines, Mic } from "lucide-react";
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

/** Light object illustrations matching the approved preview, separate from navigation icons. */
function ProgressArt({ kind, className }: { kind: "mistakes" | "words" | "review"; className?: string }) {
  return <svg viewBox="0 0 160 130" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    {kind === "words" ? <>
      <path d="M38 25C61 16 108 20 123 34C136 47 134 76 122 85L132 109C119 107 108 98 101 94C78 98 43 94 31 82C18 69 20 39 38 25Z" />
      <circle cx="56" cy="57" r="3" fill="currentColor" stroke="none" /><circle cx="78" cy="59" r="3" fill="currentColor" stroke="none" /><circle cx="100" cy="61" r="3" fill="currentColor" stroke="none" />
      <path d="M15 86L7 80M18 101L7 99" />
    </> : <>
      <path d="M98 102L47 110Q40 110 39 103L28 30Q27 23 34 22L94 12Q101 11 103 19L114 76" />
      <path d="M46 39L84 33M49 54L91 48M52 69L80 65" />
      <circle cx="116" cy="96" r="23" />
      {kind === "mistakes" ? <><path d="M116 84L115 96" /><circle cx="115" cy="104" r="1.5" fill="currentColor" stroke="none" /></> : <path d="M105 96L113 104L127 88" />}
      <path d="M14 43L7 36M17 59L5 57M128 28L133 18" />
    </>}
  </svg>;
}

export default function ProgressPage() {
  const q = useProgress();
  const p = q.data;

  const comparison = (metric: Metric) => {
    const baseline = p?.baseline?.[metric.key];
    return baseline == null ? "No comparison yet" : `First sessions: ${show(metric, baseline)}`;
  };

  return (
    <div className="w-full pb-10 pt-3 lg:pt-5">
      <header className="mb-9 sm:mb-12">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted">Your learning snapshot</p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl xl:text-5xl">Small steps. Real progress.</h1>
        <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">Your speaking metrics and what to work on next.</p>
      </header>
      {q.isLoading ? <Skeleton className="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !p ? null : (
        <div className="space-y-7 lg:space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            {METRICS.slice(0, 2).map((metric, index) => {
              const value = p.current[metric.key];
              return (
                <section key={metric.key} aria-label={metric.label} className={`relative overflow-hidden rounded-card p-7 sm:p-8 lg:min-h-[250px] lg:p-10 ${index === 0 ? "bg-mint/70" : "bg-butter/70"}`}>
                  <div className="relative z-10 max-w-[68%]">
                    <h2 className="text-sm font-medium text-ink/70 sm:text-base">{metric.label}</h2>
                    <p className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl xl:text-7xl">{show(metric, value)}</p>
                    {value === null && <p className="mt-2 text-sm text-muted">{metric.missing}</p>}
                    {metric.key === "mistakesPer100" && p.mistakesChange !== null && (
                      <p className="mt-3 text-sm font-medium">{changeText(p.mistakesChange)}</p>
                    )}
                    <p className="mt-3 text-sm text-muted">{comparison(metric)}</p>
                  </div>
                  <ProgressArt kind={index === 0 ? "mistakes" : "words"} className={`absolute right-3 top-1/2 h-24 w-28 -translate-y-1/2 sm:right-5 lg:right-8 lg:h-36 lg:w-44 ${index === 0 ? "text-[#70A794]" : "text-[#C89B31]"}`} />
                </section>
              );
            })}
          </div>

          <Card className="p-7 sm:p-8 lg:p-10">
            <h2 className="text-lg font-semibold sm:text-xl">Voice practice metrics</h2>
            <p className="mt-1 text-sm text-muted">Based on your spoken answers.</p>
            <div className="mt-8 grid gap-7 xl:mt-10 xl:grid-cols-2 xl:gap-0 xl:divide-x xl:divide-line">
              {METRICS.slice(2).map((metric, index) => {
                const value = p.current[metric.key];
                const Icon = index === 0 ? Mic : AudioLines;
                return <div key={metric.key} className={`flex items-center gap-5 lg:gap-7 ${index === 1 ? "border-t border-line pt-7 xl:border-t-0 xl:pl-10 xl:pt-0" : "xl:pr-10"}`}>
                  <span className={`flex h-16 w-16 shrink-0 lg:h-20 lg:w-20 items-center justify-center rounded-full ${index === 0 ? "bg-lilac/60 text-[#8D7DC1]" : "bg-mint/60 text-[#548B78]"}`}><Icon aria-hidden="true" size={32} strokeWidth={1.4} /></span>
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

          <Card className="p-7 sm:p-8 lg:p-10">
            <h2 className="text-lg font-semibold sm:text-xl">Top mistakes</h2>
            <p className="mt-1 text-sm text-muted">From your last 5 sessions</p>
            {p.topMistakes.length === 0 ? (
              <div className="mt-8 flex flex-col items-start gap-6 lg:mt-10 lg:flex-row lg:items-center lg:gap-8">
                <span className="flex h-24 w-28 shrink-0 items-center justify-center rounded-[40%] bg-peach/40 text-[#BF8254] lg:h-28 lg:w-32"><ProgressArt kind="review" className="h-24 w-28 lg:h-28 lg:w-32" /></span>
                <div className="flex-1">
                  <h3 className="text-base font-semibold">Your next session will tell us more</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">No corrections to show yet. Complete a practice session to see what to work on next.</p>
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
