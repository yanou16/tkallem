"use client";
import { useEffect, useId, useState } from "react";
import { Check, Flame, Mic, Square, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceRecorder, type Recording } from "@/features/ai-chat/hooks/useVoiceRecorder";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import type { ExplainLang } from "@/features/auth/types/user";
import { useCheckPhrase, usePhraseOfDay } from "../hooks/usePhraseOfDay";
import { readDays, recordDay, saidToday, streak } from "../lib/days";
import { checkView, meaningOf, meaningToggle, otherLang, streakText, type CheckView } from "../lib/phraseView";
import { canSpeak, speak } from "../lib/speak";

const storage = () => { try { return window.localStorage; } catch { return null; } };

const PILL = "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition active:scale-[0.97]";

/** The idiom of the day, as a dark strip (the design system's emphasis surface, like the stat card): one phrase, one
 *  action ("Say it"), and the meaning one tap away. It disappears quietly if the phrase cannot be loaded (nothing here
 *  is worth an error screen). */
export default function PhraseOfTheDay() {
  const { user } = useCurrentUser();
  const phrase = usePhraseOfDay();
  const check = useCheckPhrase();
  const [lang, setLang] = useState<ExplainLang | null>(null);
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [view, setView] = useState<CheckView | null>(null);
  const [listenable, setListenable] = useState(false);
  const detailsId = useId();
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

  if (phrase.isLoading) return <div className="h-28 animate-pulse rounded-card bg-black/[0.06]" aria-hidden />;
  if (!phrase.data) return null;
  const p = phrase.data;
  const done = saidToday(days, p.date) || view?.nailed === true;
  const streakDays = streak(days, p.date);
  const shownLang = lang ?? user?.explainLang ?? "fr";
  const problem = rec.error ?? check.error?.message;
  const toggle = async () => {
    if (rec.isRecording) return send(await rec.stop());
    rec.clearError();
    check.reset();
    setView(null);
    window.speechSynthesis?.cancel(); // the microphone must not hear the browser's voice
    rec.start();
  };

  return (
    <section aria-labelledby={`${detailsId}-title`} className="rounded-card bg-ink px-5 py-[18px] text-white">
      <h2 id={`${detailsId}-title`} className="text-[13px] font-medium text-hairline-strong">Idiom of the day · say it out loud</h2>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p className="min-w-0 break-words text-xl font-medium leading-tight">{p.text}</p>
        {done ? (
          <p role="status" className={cn(PILL, "bg-good-bg text-good")}><Check size={16} aria-hidden /> Nailed it</p>
        ) : (
          <button type="button" onClick={toggle} disabled={check.isPending}
            className={cn(PILL, "bg-white text-ink disabled:opacity-60")}>
            {rec.isRecording
              ? <><Square size={14} aria-hidden /> Stop and check ({Math.floor(rec.seconds)}s)</>
              : check.isPending ? "Checking…"
              : <><Mic size={16} aria-hidden /> {view ? "Try again" : "Say it"}</>}
          </button>
        )}
      </div>

      {(view && !view.nailed) || problem ? (
        <div role="status" className="mt-2 space-y-0.5 text-sm text-hairline">
          {view && !view.nailed && <p><span className="font-semibold">{view.title}. </span>{view.text}</p>}
          {problem && <p>{problem}</p>}
        </div>
      ) : null}

      {done && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-hairline">
          {streakDays > 0 && <><Flame size={16} aria-hidden /> <span className="font-semibold text-white">{streakText(streakDays)}</span> ·</>} Come back tomorrow for a new phrase.
        </p>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={detailsId}
        className="mt-1 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
        {meaningToggle(shownLang)}
      </button>
      {open && (
        <div id={detailsId} className="space-y-2 pb-1 text-sm">
          <p className="text-hairline">{meaningOf(p, shownLang)}</p>
          <p className="break-words text-hairline-strong">Example: {p.example}</p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {listenable && (
              <button type="button" onClick={() => speak(p.text)} className={cn(PILL, "border border-stone text-white")}>
                <Volume2 size={16} aria-hidden /> Listen
              </button>
            )}
            <button type="button" onClick={() => setLang(otherLang(shownLang))} className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4">
              {shownLang === "fr" ? "Show in English" : "Voir en français"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
