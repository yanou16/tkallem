"use client";
import Link from "next/link";
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
      <PageHeader title="Your phrases" subtitle="Your own corrections, kept here. Say each one out loud until it comes out clean." />
      {q.isLoading ? <Skeleton className="h-56" /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <EmptyState title="No phrases yet" text="Answer a question in Practice: every sentence the coach corrects is kept here for you to say again."
          action={<Link href="/practice" className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white">Choose a situation</Link>} />
      ) : (
        <div className="space-y-4">
          <p role="status" className="font-medium">{nailedCount(list, nailed)} of {list.length} nailed</p>
          {isGuest && <GuestSaveNote />}
          <ul className="space-y-4">
            {list.map((p) => (
              <PhraseCard key={phraseKey(p)} phrase={p} nailed={nailed.has(phraseKey(p))}
                onNailed={() => setNailed((n) => markNailed(storage(), n, phraseKey(p)))} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
