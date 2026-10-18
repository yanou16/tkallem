"use client";
import { useEffect, useState } from "react";
import { Languages, Lightbulb, X } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useHint } from "../hooks/useAiChat";
import { NUDGE_AFTER_MS, hintView, remainingText, shouldNudge, type HintView } from "../lib/hint";

type Props = {
  sessionId: string;
  questionKey: string; // changes with each coach line: a new question resets the panel
  question?: string; // the coach's line, repeated in the open panel (on a small phone the conversation above it is tiny)
  typing: boolean;
  recording: boolean;
  busy: boolean; // the coach is thinking or speaking
  onUse: (text: string) => void; // puts the hint in the answer field
};

/** "Help me start" (docs/JURY_BRIEF.md, improvement 1): the first words of an answer, or the student's idea said in
 *  French or Darija turned into English. Always under the question; highlighted when the student has not started
 *  5 seconds after it. Free, 2 per question. */
export default function HelpMeStart({ sessionId, questionKey, question, typing, recording, busy, onUse }: Props) {
  const hint = useHint(sessionId);
  const [open, setOpen] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [idea, setIdea] = useState("");
  const [view, setView] = useState<HintView | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // A new coach line: a fresh panel and a fresh 5-second wait.
  useEffect(() => {
    setOpen(false); setTranslating(false); setIdea(""); setView(null); setLeft(null); hint.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey]);
  useEffect(() => { setShownAt(busy ? null : Date.now()); }, [questionKey, busy]);
  useEffect(() => {
    if (shownAt === null) return;
    const t = setTimeout(() => setNow(Date.now()), NUDGE_AFTER_MS + 50);
    return () => clearTimeout(t);
  }, [shownAt]);

  const nudge = !open && shouldNudge({ questionShownAt: shownAt, now, typing, recording, busy });
  const used = left === 0;
  // Closing or using a hint brings the two choices back next time (the count of hints left stays).
  const close = () => { setOpen(false); setTranslating(false); setIdea(""); setView(null); hint.reset(); };
  if (recording) return null;

  const ask = (type: "starter" | "translate") =>
    hint.mutate(type === "starter" ? { type } : { type, text: idea.trim() }, {
      onSuccess: (h) => { setView(hintView(h, type)); setLeft(h.remaining); setTranslating(false); },
      onError: (e) => { if (e instanceof ApiError && e.status === 429) setLeft(0); }, // the API's message says why
    });

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <button onClick={() => setOpen(true)} disabled={busy}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold disabled:opacity-50",
            nudge ? "border-ink ring-2 ring-ink" : "border-line")}>
          <Lightbulb size={16} aria-hidden /> Help me start
        </button>
        {nudge && <span className="text-sm text-muted">Stuck? Get the first words.</span>}
      </div>
    );
  }

  const error = hint.error?.message;
  return (
    <section aria-label="Help me start" className="mx-4 mt-3 rounded-2xl border border-line bg-surface p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><p className="font-semibold">Help me start</p>{question && <p className="mt-0.5 truncate text-slate">{question}</p>}</div>
        <button onClick={close} aria-label="Close help" className="-my-2 -mr-2 flex size-11 items-center justify-center rounded-full">
          <X size={16} />
        </button>
      </div>

      <div role="status" className="space-y-1.5">
        {view && (
          <>
            <p className="mt-1 text-charcoal">{view.title}</p>
            {view.lines.map((l, i) => (
              <button key={l} onClick={() => { onUse(view.fills[i]); close(); }}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left text-base text-ink">
                <span>{l}</span><span className="shrink-0 text-sm font-semibold">Use it</span>
              </button>
            ))}
            {left !== null && <p className="pt-1 text-muted">{remainingText(left)}</p>}
          </>
        )}
        {error && <p className="mt-1 text-ink">{error}</p>}
      </div>

      {!view && !translating && used && !error && <p className="mt-1 text-charcoal">{remainingText(0)} Try with a short sentence.</p>}
      {!view && !translating && !used && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => ask("starter")} disabled={hint.isPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 font-semibold text-white disabled:opacity-50">
            <Lightbulb size={16} aria-hidden /> {hint.isPending ? "Thinking…" : "Give me the first words"}
          </button>
          <button onClick={() => setTranslating(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-white px-4 font-semibold">
            <Languages size={16} aria-hidden /> Say it in French or Darija
          </button>
        </div>
      )}

      {!view && translating && (
        <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); if (idea.trim()) ask("translate"); }}>
          <label htmlFor="hint-idea" className="block text-charcoal">Your idea in French or Darija</label>
          <textarea id="hint-idea" value={idea} onChange={(e) => setIdea(e.target.value)} maxLength={500} rows={2}
            placeholder="Mon père va payer mes études" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-base" />
          <button type="submit" disabled={hint.isPending}
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 font-semibold text-white disabled:opacity-50">
            {hint.isPending ? "Translating…" : "Turn it into English"}
          </button>
        </form>
      )}
    </section>
  );
}
