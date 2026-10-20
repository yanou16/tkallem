"use client";
import { useState } from "react";
import { Check, SpellCheck, X } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { useCheckDraft } from "../hooks/useGroups";
import { checkError, correctionLabel } from "../lib/labels";

/** Private draft feedback; the compact version opens above the composer without shrinking the conversation. */
export default function CheckPanel({ groupId, draft, maxLength, compact = false }: { groupId: number; draft: string; maxLength: number; compact?: boolean }) {
  const check = useCheckDraft(groupId);
  const [open, setOpen] = useState(false);
  const text = draft.trim();
  const checkedThisDraft = check.isSuccess && check.variables === text;
  const disabled = !text || text.length > maxLength || check.isPending;
  const review = () => { setOpen(true); if (!checkedThisDraft) check.mutate(text); };
  const feedback = <div aria-live="polite" className="space-y-3">
    {check.isPending && <p className="text-sm text-muted">Checking your draft…</p>}
    {check.error && <p role="alert" className="rounded-xl bg-bad-bg p-3 text-sm">{checkError(check.error)}</p>}
    {check.isSuccess && !checkedThisDraft && <p className="text-sm text-muted">Your draft changed. Check it again before sending.</p>}
    {check.isSuccess && check.data.length === 0 && <p className="flex items-center gap-2 rounded-xl bg-good-bg p-3 text-sm"><Check size={16} />No mistakes found.</p>}
    {check.data && check.data.length > 0 && <ul className="space-y-3">{check.data.map((c, i) => <li key={i} className="rounded-xl bg-surface p-3 text-sm"><p><s className="text-bad">{c.original}</s> → <strong className="text-good">{c.correction}</strong></p><p className="mt-1 text-muted">{c.explanation}</p><Pill className="mt-2 border border-line">{correctionLabel(c)}</Pill></li>)}</ul>}
  </div>;

  if (compact) return <div>
    <button type="button" disabled={disabled} onClick={review} aria-expanded={open} aria-controls="group-draft-feedback"
      className="inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-sm font-medium text-charcoal hover:bg-surface disabled:opacity-40">
      <SpellCheck size={17} />{check.isPending ? "Checking…" : "Check my English"}
    </button>
    {open && <section id="group-draft-feedback" aria-label="Private draft corrections" className="absolute bottom-full left-3 right-3 z-20 mb-2 max-h-[min(45dvh,360px)] overflow-y-auto rounded-2xl border border-line bg-white p-4 shadow-soft sm:right-auto sm:w-[min(440px,calc(100%-24px))]">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Check my English</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close draft corrections" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface"><X size={18} /></button></div>
      <p className="mb-3 text-xs text-muted">Private feedback. Your message has not been sent.</p>
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
