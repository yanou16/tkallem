"use client";
import { useEffect, useRef, useState } from "react";
import { Check, SpellCheck, X } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { useCheckDraft } from "../hooks/useGroups";
import { checkError, correctionLabel } from "../lib/labels";

/** Private draft feedback; the compact version opens above the composer without shrinking the conversation. */
export default function CheckPanel({ groupId, draft, maxLength, compact = false, onApply }: { groupId: number; draft: string; maxLength: number; compact?: boolean; onApply?: (text: string) => void }) {
  const check = useCheckDraft(groupId);
  const [open, setOpen] = useState(false);
  const text = draft.trim();
  const checkedThisDraft = check.isSuccess && check.variables === text;
  const disabled = text.length > maxLength || check.isPending;
  // Always clickable: with nothing written it says what to do, instead of a faint disabled link.
  const review = () => { setOpen(true); if (text && !checkedThisDraft) check.mutate(text); };
  // The message was sent (the draft went from something to nothing): the panel about that draft is stale, close it.
  const hadText = useRef(false);
  useEffect(() => {
    if (hadText.current && !text) setOpen(false);
    hadText.current = !!text;
  }, [text]);
  const feedback = <div aria-live="polite" className="space-y-3">
    {!text && !check.isPending && <p className="text-sm text-muted">Write your message first, then check it here. Nothing is sent.</p>}
    {check.isPending && <p className="text-sm text-muted">Checking your draft…</p>}
    {check.error && <p role="alert" className="rounded-xl bg-bad-bg p-3 text-sm">{checkError(check.error)}</p>}
    {text && check.isSuccess && !checkedThisDraft && <p className="text-sm text-muted">Your draft changed. Check it again before sending.</p>}
    {checkedThisDraft && check.data.length === 0 && <p className="flex items-center gap-2 rounded-xl bg-good-bg p-3 text-sm"><Check size={16} />No mistakes found.</p>}
    {checkedThisDraft && check.data && check.data.length > 0 && <ul className="space-y-3">{check.data.map((c, i) => <li key={i} className="rounded-xl bg-surface p-3 text-sm"><p><s className="text-bad">{c.original}</s> → <strong className="text-good">{c.correction}</strong></p><p className="mt-1 text-muted">{c.explanation}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Pill className="border border-line">{correctionLabel(c)}</Pill>{onApply && draft.includes(c.original) && <button type="button" onClick={() => onApply(draft.replace(c.original, c.correction))} className="inline-flex min-h-11 items-center rounded-full border border-ink px-4 text-sm font-semibold transition-transform active:scale-[0.98]">Use this fix</button>}</div></li>)}</ul>}
  </div>;

  if (compact) return <div>
    <button type="button" disabled={disabled} onClick={review} aria-expanded={open} aria-controls="group-draft-feedback"
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-charcoal transition-[background-color,transform] hover:bg-surface active:scale-[0.98] disabled:opacity-50">
      <SpellCheck size={16} />{check.isPending ? "Checking…" : "Check my English"}
    </button>
    {open && <section id="group-draft-feedback" aria-label="Private draft corrections" className="absolute bottom-full left-4 right-4 sm:left-6 sm:right-auto sm:w-[min(460px,calc(100%-48px))] z-30 mb-2 max-h-[min(50dvh,380px)] overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-ink">Check my English</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close draft corrections" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface"><X size={16} /></button></div>
      <p className="mb-3 text-sm text-muted">Private feedback. Your message has not been sent.</p>
      {feedback}
    </section>}
  </div>;

  return <Card>
    <h2 className="text-lg font-semibold">Check my message</h2>
    <p className="mt-1 text-sm text-muted">Only you see the corrections. Nothing is posted.</p>
    <Button type="button" dark={false} className="my-4 w-full" disabled={disabled} onClick={review}>{check.isPending ? "Checking…" : "Check my draft"}</Button>
    {!text && !check.data && <p className="text-sm text-muted">Write your message in the box, then check it here.</p>}
    {feedback}
  </Card>;
}
