"use client";
import { Check } from "lucide-react";
import { Card } from "@/components/ui";
import { timeAgo } from "@/lib/utils";
import SayItAgain from "@/features/ai-chat/components/SayItAgain";
import type { Phrase } from "../types/phrases";

/** One corrected answer: what the student said, the corrected sentence, each fix with its reason, and "Say it again".
 *  Once nailed (this visit or an earlier one on this device) the button gives way to a "Nailed it" mark. */
export default function PhraseCard({ phrase, nailed, onNailed }: { phrase: Phrase; nailed: boolean; onNailed: () => void }) {
  return (
    <li>
      <Card className="h-full space-y-4 !p-6 sm:!p-8">
        <p className="text-sm text-muted">{phrase.title} · {timeAgo(phrase.startedAt)}</p>
        <div className="space-y-1">
          <p className="break-words text-steel"><span className="sr-only">You said: </span><s>{phrase.original}</s></p>
          <p className="break-words text-lg font-semibold text-[color:var(--good)]"><span className="sr-only">Say instead: </span>{phrase.corrected}</p>
        </div>
        <ul className="space-y-1 text-sm text-slate">
          {phrase.corrections.map((c, i) => (
            <li key={i} className="break-words"><s className="text-steel">{c.original}</s> → <span className="font-semibold text-ink">{c.fixed}</span>
              <span className="block">{c.why}</span></li>
          ))}
        </ul>
        {nailed ? (
          <p className="inline-flex min-h-11 items-center gap-2 rounded-full bg-good-bg px-4 text-sm font-semibold text-good" role="status">
            <Check size={16} aria-hidden /> Nailed it
          </p>
        ) : (
          <SayItAgain sessionId={phrase.sessionId} turn={phrase.turn} onNailed={onNailed} />
        )}
      </Card>
    </li>
  );
}
