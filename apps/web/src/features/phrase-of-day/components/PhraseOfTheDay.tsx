"use client";
import { useEffect, useState } from "react";
import { Flame, Mic, Square, Volume2 } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import ExplainToggle from "@/features/ai-chat/components/ExplainToggle";
import { useVoiceRecorder, type Recording } from "@/features/ai-chat/hooks/useVoiceRecorder";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import type { ExplainLang } from "@/features/auth/types/user";
import { useCheckPhrase, usePhraseOfDay } from "../hooks/usePhraseOfDay";
import { readDays, recordDay, saidToday, streak } from "../lib/days";
import { checkView, KIND_LABEL, KIND_NOTE, meaningOf, streakText, type CheckView } from "../lib/phraseView";
import { canSpeak, speak } from "../lib/speak";

const storage = () => { try { return window.localStorage; } catch { return null; } };

/** A secondary card on Home: one phrase a day, explained, to say out loud. It never gets in front of the practice cards,
 *  and it disappears quietly if the phrase cannot be loaded (nothing here is worth an error screen). */
export default function PhraseOfTheDay({ compact = false }: { compact?: boolean }) {
  const { user } = useCurrentUser();
  const phrase = usePhraseOfDay();
  const check = useCheckPhrase();
  const [lang, setLang] = useState<ExplainLang | null>(null);
  const [days, setDays] = useState<string[]>([]);
  const [view, setView] = useState<CheckView | null>(null);
  const [listenable, setListenable] = useState(false);
  useEffect(() => { setDays(readDays(storage())); setListenable(canSpeak()); }, []);

  const send = (r: Recording | null) => {
    const today = phrase.data?.date;
    if (!r || !today) return; // too short or silent: the recorder says why
    check.mutate(r.blob, {
      onSuccess: (res) => {
        const v = checkView(res);
        setView(v);
        if (v.nailed) setDays((d) => recordDay(storage(), d, today));
      },
    });
  };
  const rec = useVoiceRecorder({ onAutoStop: send });

  if (phrase.isLoading) return <Card><div className="h-28 animate-pulse rounded-xl bg-black/[0.06]" aria-hidden /></Card>;
  if (!phrase.data) return null;
  const p = phrase.data;
  const done = saidToday(days, p.date) || view?.nailed === true;
  const streakDays = streak(days, p.date);
  const note = KIND_NOTE[p.kind];
  const shownLang = lang ?? user?.explainLang ?? "fr";
  const problem = rec.error ?? check.error?.message;
  const meaning = (
    <>
      <ExplainToggle value={shownLang} onChange={setLang} label="Meaning in" />
      <p className="mt-2 text-sm text-charcoal">{meaningOf(p, shownLang)}</p>
      <p className="mt-2 break-words text-sm text-muted">Example: {p.example}</p>
    </>
  );
  const toggle = async () => {
    if (rec.isRecording) return send(await rec.stop());
    rec.clearError();
    check.reset();
    setView(null);
    window.speechSynthesis?.cancel(); // the microphone must not hear the browser's voice
    rec.start();
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Phrase of the day</h2>
        <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">{KIND_LABEL[p.kind]}</span>
      </div>
      <p className="mt-3 break-words text-xl font-semibold leading-snug">{p.text}</p>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      {compact ? (
        <details className="mt-2 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-4">Meaning and example</summary>
          {meaning}
        </details>
      ) : (
        <div className="mt-3">{meaning}</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {listenable && (
          <button type="button" onClick={() => speak(p.text)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-white px-4 text-sm font-semibold transition active:scale-[0.97]">
            <Volume2 size={16} aria-hidden /> Listen
          </button>
        )}
        {done ? (
          <p role="status" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-good-bg px-4 text-sm font-semibold text-good">
            Nailed it · come back tomorrow
          </p>
        ) : (
          <button type="button" onClick={toggle} disabled={check.isPending}
            className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-50",
              rec.isRecording ? "border-ink bg-ink text-white" : "border-hairline-strong bg-white")}>
            {rec.isRecording
              ? <><Square size={14} aria-hidden /> Stop and check ({Math.floor(rec.seconds)}s)</>
              : check.isPending ? "Checking…"
              : <><Mic size={16} aria-hidden /> {view ? "Try again" : "Say it"}</>}
          </button>
        )}
        {streakDays > 0 && (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold" title="Days in a row, on this device">
            <Flame size={16} aria-hidden className="text-[color:var(--warn)]" /> {streakText(streakDays)}
          </p>
        )}
      </div>
      <div role="status" className="mt-2 space-y-0.5 text-sm">
        {view && !view.nailed && <p className="text-charcoal"><span className="font-semibold">{view.title}. </span>{view.text}</p>}
        {problem && <p className="text-charcoal">{problem}</p>}
      </div>
    </Card>
  );
}
