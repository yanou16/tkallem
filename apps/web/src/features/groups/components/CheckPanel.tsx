"use client";
import { Check } from "lucide-react";
import { Button, Card, Pill } from "@/components/ui";
import { useCheckDraft } from "../hooks/useGroups";
import { checkError, correctionLabel } from "../lib/labels";

/**
 * "Check my message": the draft of the composer, corrected privately by the coach's corrector (POST /groups/{id}/check).
 * Nothing is posted or stored; she edits her draft and sends it herself.
 */
export default function CheckPanel({ groupId, draft, maxLength }: { groupId: number; draft: string; maxLength: number }) {
  const check = useCheckDraft(groupId);
  const text = draft.trim();
  const checkedThisDraft = check.isSuccess && check.variables === text;

  return (
    <Card>
      <h2 className="text-lg font-semibold">Check my message</h2>
      <p className="mt-1 text-sm text-muted">Only you see the corrections. Nothing is posted.</p>
      <Button dark={false} className="mt-4 w-full" onClick={() => check.mutate(text)}
        disabled={!text || text.length > maxLength || check.isPending}>
        {check.isPending ? "Checking…" : "Check my draft"}
      </Button>
      {!text && !check.data && <p className="mt-3 text-sm text-muted">Write your message in the box, then check it here.</p>}

      {check.error && <p role="alert" className="mt-4 rounded-2xl bg-bad-bg px-4 py-3 text-sm">{checkError(check.error)}</p>}
      {check.data && !check.error && (
        <div className="mt-4">
          {!checkedThisDraft && <p className="mb-2 text-sm text-muted">Your draft changed since this check.</p>}
          {check.data.length === 0 ? (
            <p className="flex items-center gap-2 rounded-2xl bg-good-bg px-4 py-3 text-sm"><Check size={16} /> No mistakes found.</p>
          ) : (
            <ul className="space-y-3">
              {check.data.map((c, i) => (
                <li key={i} className="rounded-correction border border-[color:var(--hairline-soft)] bg-[color:var(--surface)] p-3 text-sm">
                  <p><s className="text-steel">{c.original}</s> → <span className="font-semibold text-[color:var(--good)]">{c.correction}</span></p>
                  <p className="mt-1 text-sm text-muted">{c.explanation}</p>
                  <Pill className="mt-2 border border-line">{correctionLabel(c)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
