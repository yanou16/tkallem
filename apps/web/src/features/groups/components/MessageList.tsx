"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { Avatar, Button, Dialog, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useLoadOlder, useReportMessage } from "../hooks/useGroups";
import { REASON_LABELS, memberName, reportError } from "../lib/labels";
import { groupMessages } from "../lib/messages";
import { REPORT_REASONS, type GroupMessage, type MessageLog, type ReportReason } from "../types/groups";

/** Pixels from the bottom under which a new message scrolls the list down (she is reading the latest ones). */
const NEAR_BOTTOM = 120;

/** A chat bubble (DESIGN.md radii: --radius-bubble, the tail corner --radius-input). Long words wrap inside it. */
const BUBBLE = "min-w-0 max-w-[65%] whitespace-pre-wrap rounded-bubble px-4 py-2.5 [overflow-wrap:anywhere]";

/** "18:42": the time of a group's first message, in the student's time zone. */
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The chat, oldest first. A new message keeps the list at the bottom when she was already there (or wrote it); an older
 * page loaded above keeps the same message in view.
 */
export default function MessageList({ groupId, log, myId }: { groupId: number; log: MessageLog; myId?: number }) {
  const older = useLoadOlder(groupId);
  const [reporting, setReporting] = useState<GroupMessage | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const seen = useRef<{ first?: number; last?: number; height: number; top: number }>({ height: 0, top: 0 });
  const atBottom = useRef(true);
  const { messages } = log;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const first = messages[0]?.id;
    const last = messages[messages.length - 1];
    const before = seen.current;
    if (before.first !== undefined && first !== undefined && first < before.first && last?.id === before.last) {
      el.scrollTop = el.scrollHeight - before.height + before.top; // older page added above
    } else if (last && last.id !== before.last && (atBottom.current || last.author.id === myId)) {
      el.scrollTop = el.scrollHeight;
    }
    seen.current = { first, last: last?.id, height: el.scrollHeight, top: el.scrollTop };
  }, [messages, myId]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    seen.current = { ...seen.current, height: el.scrollHeight, top: el.scrollTop };
  };

  return (
    <>
      <div ref={box} onScroll={onScroll} className="max-h-[60vh] min-h-[240px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {log.hasOlder && (
          <div className="flex justify-center">
            <Button dark={false} onClick={() => older.mutate()} disabled={older.isPending} className="!py-1.5 text-xs">
              {older.isPending ? "Loading…" : "Load earlier messages"}
            </Button>
          </div>
        )}
        {older.error && <p role="alert" className="rounded-2xl bg-bad-bg px-4 py-3 text-sm">{older.error.message}</p>}
        {messages.length === 0 ? (
          <EmptyState title="No messages yet" text="Answer today's question to start the conversation." />
        ) : (
          <ul className="space-y-4">
            {groupMessages(messages).map((g) => g.author.id === myId ? (
              <li key={g.messages[0].id} className="flex flex-col items-end gap-1">
                <p className="px-1 text-xs text-muted"><span className="sr-only">You · </span>{clock(g.startedAt)}</p>
                {g.messages.map((m) => (
                  <p key={m.id} className={cn(BUBBLE, "rounded-br-input bg-ink text-white")}>{m.body}</p>
                ))}
              </li>
            ) : (
              <li key={g.messages[0].id} className="flex items-end gap-2">
                {/* A former member: "?" on light grey (Avatar's own background), like a member without a first name. */}
                <Avatar first={g.authorLeft ? undefined : g.author.firstName ?? undefined} size={32} className="shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="px-1 text-xs text-muted">
                    {g.authorLeft ? "Former member" : <span className="font-medium text-ink">{memberName(g.author)}</span>} · {clock(g.startedAt)}
                  </p>
                  {g.messages.map((m) => (
                    <div key={m.id} className="flex items-center">
                      <p className={cn(BUBBLE, "rounded-bl-input border border-line bg-white")}>{m.body}</p>
                      <button onClick={() => setReporting(m)} aria-label={`Report the message of ${memberName(m.author)}`}
                        className="group flex h-11 w-11 shrink-0 items-center justify-center text-muted">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-black/5"><Flag size={16} /></span>
                      </button>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {reporting && <ReportDialog groupId={groupId} message={reporting} onClose={() => setReporting(null)} />}
    </>
  );
}

function ReportDialog({ groupId, message, onClose }: { groupId: number; message: GroupMessage; onClose: () => void }) {
  const report = useReportMessage(groupId);
  const [reason, setReason] = useState<ReportReason | null>(null);

  return (
    <Dialog open title="Report this message" onClose={onClose}>
      {report.isSuccess ? (
        <>
          <p className="text-sm">
            {report.data.hidden
              ? "Thank you. The message is now hidden for the whole group."
              : "Thank you. A message is hidden for the whole group when 3 members report it."}
          </p>
          <div className="mt-4 flex justify-end"><Button onClick={onClose}>Close</Button></div>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (reason) report.mutate({ messageId: message.id, reason }); }}>
          <p className="mb-3 line-clamp-3 rounded-2xl bg-black/[0.04] px-4 py-3 text-sm text-muted">{message.body}</p>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Why?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4", reason === r ? "border-ink" : "border-line")}>
                <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
                {REASON_LABELS[r]}
              </label>
            ))}
          </fieldset>
          {report.error && <p role="alert" className="mt-3 rounded-2xl bg-bad-bg px-4 py-3 text-sm">{reportError(report.error)}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" dark={false} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!reason || report.isPending}>{report.isPending ? "Reporting…" : "Report"}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
