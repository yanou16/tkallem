"use client";
import { Check, MessageCircle, Sparkles } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import SayItAgain from "@/features/ai-chat/components/SayItAgain";
import type { Phrase } from "../types/phrases";

const TONES = ["bg-mint", "bg-butter", "bg-lilac", "bg-peach", "bg-rose"];

export default function PhraseCard({ phrase, nailed, onNailed, index = 0 }: { phrase: Phrase; nailed: boolean; onNailed: () => void; index?: number }) {
  return (
    <li className="min-w-0 self-start overflow-hidden rounded-card border border-line bg-white">
      <div className={cn("relative overflow-hidden px-6 py-6 sm:px-7", TONES[index % TONES.length])}>
        <MessageCircle aria-hidden size={72} strokeWidth={1.2} className="pointer-events-none absolute right-5 top-4 text-ink/10" />
        <p className="relative pr-16 text-xs font-medium text-ink/60">{phrase.title} · {timeAgo(phrase.startedAt)}</p>
        <p className="relative mt-5 text-xs font-medium text-ink/60">Say it this way</p>
        <p className="relative mt-2 break-words text-xl font-semibold leading-relaxed text-ink">{phrase.corrected}</p>
      </div>
      <div className="space-y-5 p-6 sm:p-7">
        <div>
          <p className="mb-1 text-xs font-medium text-muted">You said</p>
          <p className="break-words text-sm leading-relaxed text-muted"><s>{phrase.original}</s></p>
        </div>
        <details className="group rounded-2xl bg-black/[0.025] px-4 py-3">
          <summary className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium marker:content-none">
            <Sparkles size={16} aria-hidden /> Why this works
            <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs text-muted">{phrase.corrections.length} {phrase.corrections.length === 1 ? "fix" : "fixes"}</span>
          </summary>
          <ul className="mt-3 divide-y divide-line text-sm">
            {phrase.corrections.map((c, i) => (
              <li key={i} className="space-y-1 break-words py-3 first:pt-0">
                <p><s className="text-muted">{c.original}</s><span aria-hidden> → </span><span className="font-semibold">{c.fixed}</span></p>
                <p className="leading-relaxed text-muted">{c.why}</p>
              </li>
            ))}
          </ul>
        </details>
        {nailed ? (
          <p className="inline-flex min-h-11 items-center gap-2 rounded-full bg-mint px-4 text-sm font-semibold" role="status"><Check size={16} aria-hidden /> Nailed it</p>
        ) : (
          <div className="[&_button]:border-ink [&_button]:bg-ink [&_button]:text-white [&>div]:items-start [&>div]:text-left">
            <SayItAgain sessionId={phrase.sessionId} turn={phrase.turn} onNailed={onNailed} />
          </div>
        )}
      </div>
    </li>
  );
}
