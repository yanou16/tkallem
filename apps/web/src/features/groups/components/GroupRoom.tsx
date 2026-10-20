"use client";
import { useRef, useState } from "react";
import { Lightbulb, LogOut, SendHorizontal, Trophy, Users } from "lucide-react";
import { Async, Avatar, Button, Dialog, Pill, Skeleton } from "@/components/ui";
import { cn, plural } from "@/lib/utils";
import { useGroup, useGroupSocket, useLeaderboard, useLeaveGroup, useMessages, useSendMessage } from "../hooks/useGroups";
import { closedReason, memberName, sendError } from "../lib/labels";
import type { SocketStatus } from "../lib/socket";
import type { GroupSummary } from "../types/groups";
import CheckPanel from "./CheckPanel";
import Leaderboard from "./Leaderboard";
import MessageList from "./MessageList";

const MESSAGE_MAX = 500; // as the API: 1 to 500 characters, spaces at both ends removed
type Tab = "discussion" | "members";

/** Her group: the theme and question of the day, the chat (REST to send, WebSocket to receive), the members, and on
 *  the right the private check of her draft and the leaderboard. */
export default function GroupRoom({ summary }: { summary: GroupSummary }) {
  const id = summary.id;
  const group = useGroup(id);
  const messages = useMessages(id);
  const leaderboard = useLeaderboard(id);
  const status = useGroupSocket(id);
  const send = useSendMessage(id);
  const [tab, setTab] = useState<Tab>("discussion");
  const [draft, setDraft] = useState("");
  const [leaving, setLeaving] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);

  // GET /me has no id: the leaderboard says which member she is (no Report button on her own messages).
  const myId = leaderboard.data?.find((e) => e.isMe)?.member.id;
  const name = group.data?.name ?? summary.name;
  const text = draft.trim();
  const canSend = text.length >= 1 && text.length <= MESSAGE_MAX && !send.isPending;
  const submit = () => {
    if (canSend) send.mutate(text, { onSuccess: () => { setDraft(""); if (composer.current) { composer.current.style.height = ""; composer.current.focus(); } } });
  };

  return (
    <div className="relative flex h-[calc(100dvh-164px)] min-h-[320px] flex-col overflow-hidden rounded-card border border-line bg-white md:h-[calc(100dvh-112px)]">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint-visa text-lg font-semibold">{name[0]}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">{name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="flex items-center gap-1"><Users size={13} /> {plural(group.data?.members.length ?? summary.memberCount, "member")}</span>
            <span>{summary.level}</span><LiveStatus status={status} />
          </div>
        </div>
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line px-3 text-sm font-medium [&::-webkit-details-marker]:hidden"><Trophy size={16} /><span className="hidden sm:inline">Leaderboard</span><span className="sr-only sm:hidden">Leaderboard</span></summary>
          <aside className="absolute right-3 top-[76px] z-30 max-h-[60%] w-[min(340px,calc(100%-24px))] overflow-y-auto rounded-card bg-white shadow-soft" aria-label="Leaderboard"><Leaderboard query={leaderboard} /></aside>
        </details>
        <Button dark={false} onClick={() => setLeaving(true)} aria-label="Leave group" className="!px-3"><LogOut size={16} /><span className="hidden lg:inline">Leave group</span></Button>
      </header>
      {status.state === "closed" && <p role="alert" className="shrink-0 bg-bad-bg px-4 py-2 text-sm">{closedReason(status.code)}</p>}
      <div className="relative flex shrink-0 items-center gap-3 border-b border-line px-4">
        <div className="flex gap-6" role="tablist" aria-label="Group view">
          {(["discussion", "members"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("-mb-px min-h-11 border-b-2 text-sm font-medium capitalize", tab === t ? "border-ink" : "border-transparent text-muted")}>{t}</button>
          ))}
        </div>
        <details className="ml-auto">
          <summary className="my-1 flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-full bg-tint-campus px-3 text-sm [&::-webkit-details-marker]:hidden"><Lightbulb size={16} /><span>Topic</span></summary>
          <div className="absolute left-0 right-0 top-full z-20 flex max-h-[40dvh] flex-wrap items-center justify-between gap-3 overflow-y-auto border-b border-line bg-tint-campus p-4 shadow-soft"><div className="min-w-0 flex-1"><p className="text-xs text-charcoal">This week's theme: {summary.theme.title}</p><p className="mt-1 text-sm font-medium">{group.data?.theme.question ?? summary.theme.title}</p></div><Button dark={false} onClick={() => composer.current?.focus()}>Answer it</Button></div>
        </details>
      </div>
      {tab === "discussion" ? <>
        <section className="flex min-h-0 flex-1 flex-col bg-surface/40" aria-label="Discussion">
          <div className="flex min-h-0 flex-1 flex-col">
            <Async query={messages} skeleton={<Skeleton className="m-4 h-40" />}>
              {(log) => <MessageList groupId={id} log={log} myId={myId} fill />}
            </Async>
          </div>
          <form className="relative z-10 shrink-0 border-t border-line bg-white p-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label htmlFor="group-message" className="sr-only">Your message</label>
            <div className="flex items-end gap-2">
              <textarea id="group-message" ref={composer} value={draft} rows={1}
                onChange={(e) => { setDraft(e.target.value); if (send.error) send.reset(); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 120)}px`; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
                placeholder="Write a message in English…"
                className="max-h-[120px] min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-ink" />
              <Button type="submit" disabled={!canSend} className="!min-h-12 !px-4"><SendHorizontal size={18} /><span className="hidden sm:inline">{send.isPending ? "Sending…" : "Send"}</span><span className="sr-only sm:hidden">{send.isPending ? "Sending…" : "Send"}</span></Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <CheckPanel groupId={id} draft={draft} maxLength={MESSAGE_MAX} compact />
              <p className="hidden text-xs text-muted sm:block">Enter to send · Shift+Enter for a new line</p>
            </div>
            {send.error && <p role="alert" className="mt-2 rounded-xl bg-bad-bg px-3 py-2 text-sm">{sendError(send.error)}</p>}
          </form>
        </section>
      </> : <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Async query={group} skeleton={<Skeleton className="h-40" />}>
          {(g) => <div className="grid gap-3 md:grid-cols-2">{g.members.map((m) => <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3"><Avatar first={m.firstName ?? undefined} size={44} /><p className="font-semibold">{memberName(m, m.id === myId)}</p></div>)}</div>}
        </Async>
      </div>}
      {leaving && <LeaveDialog groupId={id} name={name} onClose={() => setLeaving(false)} />}
    </div>
  );
}

function LiveStatus({ status }: { status: SocketStatus }) {
  const label = { connecting: "Connecting…", live: "Live", reconnecting: "Reconnecting…", closed: "Offline" }[status.state];
  return (
    <Pill className="gap-1.5 border border-line">
      <span className={cn("h-2 w-2 rounded-full", status.state === "live" ? "bg-good" : "bg-black/20")} aria-hidden /> {label}
    </Pill>
  );
}

/** Confirmation in the page (no window.confirm). After leaving, the page shows "Join a group" again. */
function LeaveDialog({ groupId, name, onClose }: { groupId: number; name: string; onClose: () => void }) {
  const leave = useLeaveGroup(groupId);
  return (
    <Dialog open title="Leave this group?" onClose={onClose}>
      <p className="text-sm text-muted">You will leave {name}. Your messages stay in the group, and you can join a group again later.</p>
      {leave.error && <p role="alert" className="mt-3 rounded-2xl bg-bad-bg px-4 py-3 text-sm">{leave.error.message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button dark={false} onClick={onClose}>Stay</Button>
        <Button onClick={() => leave.mutate()} disabled={leave.isPending}>{leave.isPending ? "Leaving…" : "Leave group"}</Button>
      </div>
    </Dialog>
  );
}
