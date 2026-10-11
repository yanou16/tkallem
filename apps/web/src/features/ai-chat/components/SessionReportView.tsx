"use client";
import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SentenceStatus, SessionReport } from "../types/ai";

const DOT: Record<SentenceStatus, string> = { green: "bg-success", orange: "bg-orange-400", red: "bg-red-500" };
const TILE: Record<SentenceStatus, string> = { green: "bg-mint", orange: "bg-butter", red: "bg-rose" };
const STATUS_LABEL: Record<SentenceStatus, string> = { green: "Correct", orange: "Small mistakes", red: "Needs work" };

function Metric({ label, value, unit, level, hint }: { label: string; value: number | null; unit: string; level: SentenceStatus | null; hint: string }) {
  return (
    <div className={cn("rounded-2xl p-4", level ? TILE[level] : "bg-black/[0.04]")}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value === null ? "—" : value}<span className="ml-1 text-sm font-medium text-muted">{value === null ? "" : unit}</span></p>
      <p className="mt-1 text-xs text-muted">{value === null ? hint : level ? STATUS_LABEL[level] : ""}</p>
    </div>
  );
}

/** End-of-session report: honest note, three numbers with traffic lights, the transcript with every correction, and
 *  the one answer worth redoing first. */
export default function SessionReportView({ report, scenarioId }: { report: SessionReport; scenarioId?: string }) {
  const { metrics: m, levels } = report;
  const round = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">Your report</p>
        <p className="mt-2 text-lg leading-relaxed">{report.note}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Mistakes per 100 words" value={round(m.mistakes_per_100)} unit="" level={levels.mistakes_per_100} hint="Answer a question first" />
        <Metric label="Words per answer" value={round(m.words_per_answer)} unit="words" level={levels.words_per_answer} hint="Answer a question first" />
        <Metric label="Hesitations per minute" value={round(m.hesitations_per_min)} unit="/ min" level={levels.hesitations_per_min} hint="Measured on spoken answers only" />
      </div>

      <ol className="space-y-3">
        {report.lines.map((l, i) => (
          <li key={i} className={cn("rounded-2xl p-3", l.role === "student" ? "bg-black/[0.03]" : "", i === report.redo_index && "ring-2 ring-ink")}>
            <p className="flex items-start gap-2">
              {l.role === "student" && l.status && <span className={cn("mt-2 h-2.5 w-2.5 shrink-0 rounded-full", DOT[l.status])} aria-label={STATUS_LABEL[l.status]} />}
              <span className={cn(l.role === "coach" && "text-muted")}>{l.role === "coach" ? "Coach: " : "You: "}{l.text}</span>
            </p>
            {i === report.redo_index && <p className="mt-1 text-xs font-semibold">Try this answer again first</p>}
            {l.corrections.map((c, j) => (
              <div key={j} className="mt-2 rounded-xl bg-white p-2 text-sm">
                <span className="line-through decoration-red-500">{c.original}</span> <ArrowRight size={12} className="inline" /> <span className="font-semibold">{c.fixed}</span>
                <p className="text-xs text-muted">{c.why}</p>
              </div>
            ))}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        {scenarioId && (
          <Link href={`/ai-chat?scenarioId=${scenarioId}&again=${Date.now()}`} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
            <RotateCcw size={16} /> Practise this scenario again
          </Link>
        )}
        <Link href="/practice" className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold">Choose another scenario</Link>
      </div>
    </div>
  );
}
