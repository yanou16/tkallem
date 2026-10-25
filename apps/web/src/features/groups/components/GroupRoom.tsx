"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, LogOut, MessageCircle, SendHorizontal, Users } from "lucide-react";
import { Async, Avatar, Button, Dialog, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useGroup, useGroupSocket, useLeaderboard, useLeaveGroup, useMessages, useSendMessage } from "../hooks/useGroups";
import { closedReason, memberName, sendError } from "../lib/labels";
import type { SocketStatus } from "../lib/socket";
import type { GroupSummary } from "../types/groups";
import CheckPanel from "./CheckPanel";
import Leaderboard from "./Leaderboard";
import MessageList from "./MessageList";
import { memberColors } from "../lib/memberColors";

const MESSAGE_MAX = 500; // as the API: 1 to 500 characters, spaces at both ends removed
const GROUP_CAPACITY = 8; // as the API (GROUP_MAX_MEMBERS)
const COUNTER_FROM = 400; // the counter appears when the limit gets close, so a disabled Send is never a mystery
type Tab = "discussion" | "members";
const TABS: Tab[] = ["discussion", "members"];

/** Sentence starters for a B1 student facing an empty room: tapping one puts it in the message box. */
const STARTERS = ["My favourite one is…", "I think that…", "For me, the best is…"];

/**
 * Her group. Chat first (Wad2o's design): a compact header, coloured bubbles per member, a composer that stays put. Added
 * after a design critique: the room has a real height (the composer never leaves the screen), the question of the day is
 * pinned (it is the reason for the room), the ranking and "Leave group" live in the Members tab, targets and text follow the
 * app's own floors (44 px, 14 px), and an empty room shows the question and sentence starters.
 */
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
  const [expanded, setExpanded] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);

  // GET /me has no id: the leaderboard says which member she is (no Report button on her own messages).
  const me = leaderboard.data?.find((e) => e.isMe);
  const myId = me?.member.id;
  const name = group.data?.name ?? summary.name;
  const colors = memberColors(group.data?.members ?? []);
  const members = group.data?.members.length ?? summary.memberCount;
  const question = group.data?.theme.question ?? summary.theme.title;
  const text = draft.trim();
  const canSend = text.length >= 1 && text.length <= MESSAGE_MAX && !send.isPending;
  const growComposer = () => {
    const el = composer.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };
  const submit = () => {
    if (canSend) send.mutate(text, { onSuccess: () => { setDraft(""); if (composer.current) { composer.current.style.height = ""; composer.current.focus(); } } });
  };
  const setDraftTo = (value: string) => {
    setDraft(value);
    requestAnimationFrame(() => { growComposer(); composer.current?.focus(); });
  };
  const answerIt = () => { setTab("discussion"); requestAnimationFrame(() => composer.current?.focus()); };

  // Tabs: arrows move between them, only the chosen one is a Tab stop.
  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (TABS.indexOf(tab) + step + TABS.length) % TABS.length;
    setTab(TABS[next]);
    tabButtons.current[next]?.focus();
  };

  return (
    // The room is one screen between the app header and the bottom bar: only the messages scroll. (Same numbers as the
    // practice chat: 66 px header + 8 px padding above, 61 px bar below, the shell's paddings cancelled by -mb.)
    <div className="relative flex min-h-0 flex-col bg-white max-md:-mb-[120px] max-md:h-[calc(100dvh-135px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-114px)]">
      <header className="flex shrink-0 items-center gap-3 px-4 py-2 sm:px-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-tint-visa" aria-hidden><Users size={20} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{name}</h1>
          <p className="flex items-center gap-x-3 text-sm text-slate">
            <span className="truncate">{members} of {GROUP_CAPACITY}<span className="max-[359px]:hidden"> students</span></span>
            <LiveStatus status={status} />
          </p>
        </div>
        {me && <span className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold" title="Your rank this week">#{me.rank}<span className="sr-only sm:not-sr-only"> this week</span></span>}
      </header>

      {status.state === "closed" && <p role="alert" className="shrink-0 bg-bad-bg px-4 py-2 text-sm sm:px-6">{closedReason(status.code)}</p>}

      {/* The question of the day: the reason for the room, always on screen. Tap it to read it in full. */}
      <div className="shrink-0 bg-tint-campus px-4 py-2 sm:px-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="flex min-h-11 min-w-0 flex-1 items-start gap-2 text-left">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-charcoal">Today&apos;s question · {summary.theme.title}</span>
              <span className={cn("block text-base font-medium leading-snug", !expanded && "line-clamp-2")}>{question}</span>
            </span>
            <ChevronDown size={18} aria-hidden className={cn("mt-1 shrink-0 text-charcoal transition-transform", expanded && "rotate-180")} />
          </button>
          <Button dark={false} onClick={answerIt} className="shrink-0 !min-h-11 !px-4 text-sm">Answer</Button>
        </div>
      </div>

      <div className="flex shrink-0 gap-6 border-b border-line px-4 sm:px-6" role="tablist" aria-label="Group view" onKeyDown={onTabKey}>
        {TABS.map((t, i) => (
          <button key={t} ref={(el) => { tabButtons.current[i] = el; }} id={`tab-${t}`} role="tab" aria-selected={tab === t} aria-controls={`panel-${t}`} tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
            className={cn("-mb-px flex min-h-11 items-center border-b-2 text-sm font-medium transition-colors",
              tab === t ? "border-ink font-semibold text-ink" : "border-transparent text-slate hover:text-ink")}>
            {t === "discussion" ? "Discussion" : "Members"}
          </button>
        ))}
      </div>

      {tab === "discussion" ? (
        <section id="panel-discussion" role="tabpanel" aria-labelledby="tab-discussion" className="flex min-h-0 flex-1 flex-col bg-white">
          <div className="flex min-h-0 flex-1 flex-col">
            <Async query={messages} skeleton={<div className="p-4 sm:p-6"><Skeleton className="h-40" /></div>}>
              {(log) => (
                <MessageList groupId={id} log={log} myId={myId} colors={colors} fill
                  empty={<EmptyRoom question={question} members={members} onStarter={setDraftTo} />} />
              )}
            </Async>
          </div>
          <form className="relative z-10 shrink-0 border-t border-line bg-white px-4 pb-3 pt-2 sm:px-6 sm:pb-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <label htmlFor="group-message" className="sr-only">Your message</label>
            <div className="flex items-end gap-2 sm:gap-3">
              <textarea
                id="group-message"
                ref={composer}
                value={draft}
                rows={1}
                onChange={(e) => {
                  setDraft(e.target.value);
                  if (send.error) send.reset();
                  growComposer();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Write a message in English…"
                className="max-h-[120px] min-h-12 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-base outline-none transition-colors placeholder:text-steel focus:border-ink focus:bg-white"
              />
              <Button type="submit" disabled={!canSend} className="!min-h-12 shrink-0 rounded-full !px-4">
                <SendHorizontal size={18} aria-hidden />
                <span className="hidden sm:inline">{send.isPending ? "Sending…" : "Send"}</span>
                <span className="sr-only sm:hidden">{send.isPending ? "Sending…" : "Send"}</span>
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <CheckPanel groupId={id} draft={draft} maxLength={MESSAGE_MAX} compact onApply={setDraftTo} />
              {text.length >= COUNTER_FROM
                ? <p className={cn("text-sm tabular-nums", text.length > MESSAGE_MAX ? "font-semibold text-bad" : "text-slate")} aria-live="polite">{text.length} / {MESSAGE_MAX}</p>
                : <p className="hidden text-sm text-slate sm:block">Enter to send · Shift+Enter for a new line</p>}
            </div>
            {send.error && <p role="alert" className="mt-2 rounded-xl bg-bad-bg px-3 py-2 text-sm">{sendError(send.error)}</p>}
          </form>
        </section>
      ) : (
        <section id="panel-members" role="tabpanel" aria-labelledby="tab-members" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <Leaderboard query={leaderboard} colors={colors} />
          <Async query={group} skeleton={<Skeleton className="h-24" />}>
            {(g) => g.members.every((m) => leaderboard.data?.some((e) => e.member.id === m.id)) ? null : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {g.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                    <Avatar first={m.firstName ?? undefined} size={40} className={colors.get(m.id)} />
                    <p className="font-semibold text-ink">{memberName(m, m.id === myId)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Async>
          <div className="pt-2">
            <Button dark={false} onClick={() => setLeaving(true)} className="!min-h-11 text-sm"><LogOut size={16} aria-hidden /> Leave group</Button>
          </div>
        </section>
      )}
      {leaving && <LeaveDialog groupId={id} name={name} onClose={() => setLeaving(false)} />}
    </div>
  );
}

/** What a room with no message shows: the question itself, a way to start, and an honest line about who is here. */
function EmptyRoom({ question, members, onStarter }: { question: string; members: number; onStarter: (text: string) => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-tint-campus" aria-hidden><MessageCircle size={22} /></span>
      <div>
        <p className="font-semibold">{members <= 1 ? "You are the first one here" : "Nobody has answered yet"}</p>
        <p className="mt-1 text-base text-slate">Answer today&apos;s question to start: <span className="font-medium text-ink">{question}</span></p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2" aria-label="Sentence starters">
        {STARTERS.map((s) => (
          <li key={s}><button type="button" onClick={() => onStarter(s)} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-4 text-sm font-medium transition-transform hover:bg-surface active:scale-[0.98]">{s}</button></li>
        ))}
      </ul>
      <p className="text-sm text-slate">{members} of {GROUP_CAPACITY} students so far. Others at your level join as they sign up.</p>
    </div>
  );
}

/** Live is a small dot and a word; anything else says what is happening (the pill is gone: it was the loudest thing in the header). */
function LiveStatus({ status }: { status: SocketStatus }) {
  const live = status.state === "live";
  const label = { connecting: "Connecting…", live: "Live", reconnecting: "Reconnecting…", closed: "Offline" }[status.state];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", live ? "bg-good-fill" : "bg-stone")} aria-hidden />
      {label}
    </span>
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
