"use client";
import Link from "next/link";
import { Check, CircleAlert, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExplainLang } from "@/features/auth/types/user";
import type { FeedbackMode, VerdictDto } from "../types/ai";
import { noVerdictText, verdictTitle, verdictView, type VerdictTone } from "../lib/verdict";

const TONE: Record<VerdictTone, { box: string; icon: typeof Check }> = {
  good: { box: "bg-mint text-ink", icon: Check },
  warn: { box: "bg-butter text-ink", icon: Clock },
  bad: { box: "bg-rose text-ink", icon: CircleAlert },
};

/** First thing of a real interview report: ready / almost / not yet, why in two lines, and what to do next. The status is
 *  always written (not only coloured), the icon is decoration. */
export default function VerdictCard({ verdict, lang, redoIndex, mode }: { verdict: VerdictDto | null; lang: ExplainLang; redoIndex: number | null; mode: FeedbackMode }) {
  if (!verdict) return <p className="mb-4 rounded-2xl bg-surface px-4 py-3 text-sm text-charcoal">{noVerdictText(lang)}</p>;
  const v = verdictView(verdict, lang, redoIndex);
  const { box, icon: Icon } = TONE[v.tone];
  const button = "mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition active:scale-[0.97] hover:bg-black/80";
  return (
    <section aria-labelledby="verdict-title" className={cn("mb-6 rounded-card p-6 sm:p-8", box)}>
      <p className="text-sm font-medium">{verdictTitle(lang, mode)}</p>
      <h2 id="verdict-title" className="mt-1 flex items-center gap-2 text-3xl font-semibold">
        <Icon size={28} aria-hidden /> {v.label}
      </h2>
      <p className="mt-1 text-sm font-medium">{v.levelNote}</p>
      <ul className="mt-3 space-y-1 text-ink">
        {v.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      {v.action.kind === "redo"
        ? <a href="#redo-answer" className={button}>{v.action.label}</a>
        : <Link href="/practice" className={button}>{v.action.label}</Link>}
      <p className="mt-3 text-sm text-charcoal">{v.disclaimer}</p>
    </section>
  );
}
