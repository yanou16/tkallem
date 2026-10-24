"use client";
import Link from "next/link";
import { BookOpen, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { usePhrases } from "@/features/phrases/hooks/usePhrases";
import PhraseCard from "@/features/phrases/components/PhraseCard";
import { markNailed, nailedCount, phraseKey, readNailed } from "@/features/phrases/lib/nailed";
import GuestSaveNote from "@/components/GuestSaveNote";
import { EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";

const storage = () => { try { return window.localStorage; } catch { return null; } };

export default function PhrasesPage() {
  const { isGuest } = useCurrentUser();
  const q = usePhrases();
  const [nailed, setNailed] = useState<Set<string>>(new Set());
  useEffect(() => setNailed(readNailed(storage())), []);
  const list = q.data ?? [];

  return (
    <div>
      <PageHeader eyebrow="MAKE IT STICK" title="Your phrases" subtitle="Your own corrections, kept here. Say each one out loud until it comes out clean." />
      {q.isLoading ? <Skeleton className="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState title="No phrases yet" text="Answer a question in Practice: every sentence the coach corrects is kept here for you to say again."
          action={<Link href="/practice" className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Choose a situation</Link>} />
      ) : (
        <div className="space-y-4">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-card bg-lilac px-6 py-5">
            <div className="flex items-center gap-3"><BookOpen size={23} strokeWidth={1.6} aria-hidden /><div><h2 className="font-semibold">A little repetition goes a long way.</h2><p className="mt-1 text-sm text-muted">Your corrected sentences, ready to practise again.</p></div></div>
            <p role="status" className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium"><Check size={16} aria-hidden />{nailedCount(list, nailed)} of {list.length} nailed</p>
          </div>
          {isGuest && <GuestSaveNote />}
          <ul className="grid items-start gap-6 lg:grid-cols-2">
            {list.map((p, index) => (
              <PhraseCard index={index} key={phraseKey(p)} phrase={p} nailed={nailed.has(phraseKey(p))}
                onNailed={() => setNailed((n) => markNailed(storage(), n, phraseKey(p)))} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
