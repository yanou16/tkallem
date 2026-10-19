"use client";
import { useRef, useState } from "react";
import { Lightbulb, LogOut, SendHorizontal, Users } from "lucide-react";
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
    if (canSend) send.mutate(text, { onSuccess: () => setDraft("") });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-tint-visa text-2xl font-semibold">{name[0]}</span>
          <div className="min-w-0 flex-1 basis-[220px]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{name}</h1>
                <p className="mt-1 flex items-center gap-2 text-muted"><Users size={16} /> {plural(group.data?.members.length ?? summary.memberCount, "member")}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Pill className="border border-line">Level {summary.level}</Pill>
                  <LiveStatus status={status} />
                </div>
              </div>
              <Button dark={false} onClick={() => setLeaving(true)}><LogOut size={16} /> Leave group</Button>
            </div>
          </div>
        </div>
        {status.state === "closed" && <p role="alert" className="mt-4 rounded-2xl bg-bad-bg px-4 py-3 text-sm">{closedReason(status.code)}</p>}

        <div className="mt-6 flex gap-8 border-b border-line" role="tablist">
          {(["discussion", "members"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn("-mb-px min-h-11 border-b-2 pb-3 font-medium capitalize", tab === t ? "border-ink" : "border-transparent text-muted")}>
              {t}
            </button>
          ))}
        </div>

        {tab === "discussion" && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl bg-tint-campus p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60"><Lightbulb size={20} /></span>
              <div className="min-w-0 flex-1 basis-[180px]">
                <p className="text-sm">Theme of the week: {summary.theme.title}</p>
                {group.data ? <h2 className="text-lg font-semibold">{group.data.theme.question}</h2>
                  : group.isLoading ? <Skeleton className="mt-1 h-7 w-3/4" />
                  : <h2 className="text-lg font-semibold">{summary.theme.title}</h2>}
              </div>
              <Button dark={false} onClick={() => composer.current?.focus()}>Answer it</Button>
            </div>

            <section className="mt-5 overflow-hidden rounded-card border border-line bg-surface/40" aria-label="Discussion">
              <div>
                <Async query={messages} skeleton={<Skeleton className="h-64" />}>
                  {(log) => <MessageList groupId={id} log={log} myId={myId} />}
                </Async>
              </div>

              <div className="border-t border-line bg-white p-4">
                <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
                  <label htmlFor="group-message" className="sr-only">Your message</label>
                  <textarea id="group-message" ref={composer} value={draft} rows={2}
                    onChange={(e) => { setDraft(e.target.value); if (send.error) send.reset(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
                    }}
                    placeholder="Write in English… (Enter to send, Shift+Enter for a new line)"
                    className="w-full resize-none rounded-2xl border border-line bg-surface p-3 text-base outline-none focus:border-ink" />
                  <div className="mt-2 flex items-center justify-end gap-3">
                    <Button type="submit" disabled={!canSend}><SendHorizontal size={16} /> {send.isPending ? "Sending…" : "Send"}</Button>
                  </div>
                  {send.error && <p role="alert" className="mt-3 rounded-2xl bg-bad-bg px-4 py-3 text-sm">{sendError(send.error)}</p>}
                </form>
                <div className="mt-4">
                  <CheckPanel groupId={id} draft={draft} maxLength={MESSAGE_MAX} />
                </div>
              </div>
            </section>
          </>
        )}

        {tab === "members" && (
          <div className="mt-6">
            <Async query={group} skeleton={<Skeleton className="h-40" />}>
              {(g) => (
                <div className="grid gap-3 md:grid-cols-2">
                  {g.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
                      <Avatar first={m.firstName ?? undefined} size={44} />
                      <p className="font-semibold">{memberName(m, m.id === myId)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Async>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <Leaderboard query={leaderboard} />
      </aside>

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
