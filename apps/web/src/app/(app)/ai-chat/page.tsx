"use client";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ChartNoAxesColumn, ChevronDown, ChevronRight, CircleAlert, Lightbulb, MessageCircle, Mic, Send, Square, Volume2 } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { useAiSession, useAnswer, useEndSession, useSpeakLastLine, useStartSession } from "@/features/ai-chat/hooks/useAiChat";
import { CoachAvatar } from "@/components/CoachAvatar";
import InstallButton from "@/components/InstallButton";
import VoiceState, { formatTime, type CoachState } from "@/features/ai-chat/components/VoiceState";
import { MAX_RECORDING_S, useVoiceRecorder, type Recording } from "@/features/ai-chat/hooks/useVoiceRecorder";
import { useCoachVoice } from "@/features/ai-chat/hooks/useCoachVoice";
import OutOfCredits, { isCreditError } from "@/features/credits/components/OutOfCredits";
import { markSentence } from "@/features/ai-chat/lib/marks";
import type { ChatMessage, Correction, SentenceStatus, SessionReport } from "@/features/ai-chat/types/ai";
import { Avatar, Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { startHref } from "@/components/cards";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/lib/icons";
import { cn, formatMinutes, formatNumber, plural } from "@/lib/utils";

const MAX = 500;
const MODE_KEY = "tkallem.mode";
const AVATAR_KEY = "tkallem.avatar";

/** The 3D coach is off by default (heavy on phones, approximate lip sync): only for students who turn it on. */
function readAvatar(): boolean {
  try {
    return localStorage.getItem(AVATAR_KEY) === "on";
  } catch {
    return false;
  }
}

/** Voice first (it is a speaking coach); the student's last choice is remembered on this device. */
function readMode(): "text" | "voice" {
  try {
    return localStorage.getItem(MODE_KEY) === "text" ? "text" : "voice";
  } catch {
    return "voice";
  }
}

type Pending = { kind: "text"; text: string } | { kind: "voice"; seconds: number };

/* ---------- traffic lights: the color always comes with a word (docs/DESIGN.md) ---------- */
const STATUS_STYLE: Record<SentenceStatus, string> = {
  green: "bg-[color:var(--good-bg)] text-[color:var(--good)]",
  orange: "bg-[color:var(--warn-bg)] text-[color:var(--warn)]",
  red: "bg-[color:var(--bad-bg)] text-[color:var(--bad)]",
};
const STATUS_BAR: Record<SentenceStatus, string> = {
  green: "bg-[color:var(--good)]",
  orange: "bg-[color:var(--warn)]",
  red: "bg-[color:var(--bad)]",
};
const LEVEL_LABEL: Record<SentenceStatus, string> = { green: "Good", orange: "To work on", red: "Priority" };

function answerLabel(status: SentenceStatus, fixes: number) {
  if (status === "green") return "Clean";
  if (status === "red") return "Redo";
  return fixes > 0 ? plural(fixes, "fix", "fixes") : "To work on";
}

/* ---------- what to tell the student when a call fails ---------- */
type Help = { text: string; retry?: boolean; restart?: boolean; chooseLevel?: boolean };

function startHelp(e: unknown): Help {
  if (e instanceof ApiError && e.status === 409) return { text: "Choose your English level before your first session.", chooseLevel: true };
  if (e instanceof ApiError && e.status === 404) return { text: "This scenario doesn't exist. Pick another one above." };
  return { text: e instanceof ApiError ? e.message : "Something went wrong.", retry: true };
}

function answerHelp(e: unknown): Help {
  if (!(e instanceof ApiError)) return { text: "Something went wrong.", retry: true };
  if (e.status === 502) return { text: "Your coach didn't answer. Nothing was saved: send the same answer again.", retry: true };
  if (e.status === 409) return { text: "This session was ended or changed in the meantime.", restart: true };
  if (e.status === 404) return { text: "This session doesn't exist anymore.", restart: true };
  if (e.status === 422) return { text: e.message };
  return { text: e.message, retry: true };
}

function endHelp(e: unknown): Help {
  if (!(e instanceof ApiError)) return { text: "Something went wrong.", retry: true };
  if (e.status === 502) return { text: "The report could not be generated. Nothing was saved, try again.", retry: true };
  if (e.status === 409 || e.status === 404) return { text: e.message, restart: true };
  return { text: e.message, retry: true };
}

function loadHelp(e: unknown): Help {
  if (e instanceof ApiError && e.status === 404) return { text: "This session doesn't exist anymore.", restart: true };
  return { text: e instanceof ApiError ? e.message : "Something went wrong.", retry: true };
}

export default function AiChatPage() {
  return <Suspense fallback={<Skeleton className="mt-6 h-96" />}><Chat /></Suspense>;
}

function Chat() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? undefined;
  const urlScenarioId = params.get("scenarioId") ?? undefined;
  const { user, isGuest } = useCurrentUser();
  const scenarios = useScenarios();
  const start = useStartSession();
  const session = useAiSession(sessionId);
  const end = useEndSession(sessionId);
  const speakLast = useSpeakLastLine(sessionId);
  const s = session.data;
  const scenarioId = s?.scenarioId ?? urlScenarioId;

  const [mode, setMode] = useState<"text" | "voice">(readMode);
  const [avatarOn, setAvatarOn] = useState(readAvatar);
  const toggleAvatar = () => {
    coach.stop();
    setAvatarOn((on) => {
      try { localStorage.setItem(AVATAR_KEY, on ? "off" : "on"); } catch { /* private mode */ }
      return !on;
    });
  };
  const coach = useCoachVoice(mode === "voice" && avatarOn);
  // The coach's voice is played as soon as it arrives, while the corrections are still being written.
  const send = useAnswer(sessionId, (url, reply) => coach.play(url, reply));
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [menu, setMenu] = useState(false);
  const started = useRef<string | null>(null);
  const lastRecording = useRef<Recording | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const rec = useVoiceRecorder({ onAutoStop: (r) => r && sendRecording(r) });

  const begin = (id: string) => {
    started.current = id;
    // The session starts as text so the first question shows at once; in voice mode its audio is asked right after
    // (POST /speak, which also makes the session a voice session): the student reads it while the voice is made.
    start.mutate({ scenarioId: id, mode: "text" }, {
      onSuccess: (s) => {
        router.replace(`/ai-chat?sessionId=${encodeURIComponent(s.sessionId)}&scenarioId=${encodeURIComponent(id)}`);
        if (mode === "voice") speakLast.mutate(s.sessionId, { onSuccess: (r) => coach.play(r.audio_url, r.text) });
      },
    });
  };

  // Start a backend session when arriving with ?scenarioId=… only (with ?sessionId=…, the session is loaded instead).
  useEffect(() => {
    if (sessionId || !urlScenarioId || started.current === urlScenarioId) return;
    begin(urlScenarioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlScenarioId, sessionId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [s?.messages.length, pending, send.live?.reply]);

  /** A new session for this scenario, or for another one. */
  const restart = (id = scenarioId) => {
    setText("");
    coach.stop();
    send.reset();
    end.reset();
    if (!id) return router.push("/practice");
    if (!sessionId && id === urlScenarioId) return begin(id);
    started.current = null;
    router.replace(startHref(id));
  };

  const submit = () => {
    const answer = text.trim();
    if (!answer || !sessionId || !s || s.finished || send.isPending) return;
    coach.stop();
    setPending({ kind: "text", text: answer });
    // The text stays in the input until the API saved it, so a failed answer can be sent again.
    send.mutate({ text: answer }, { onSuccess: () => setText(""), onSettled: () => setPending(null) });
  };

  function sendRecording(r: Recording) {
    lastRecording.current = r;
    setPending({ kind: "voice", seconds: r.seconds });
    send.mutate({ audio: r.blob }, { onSuccess: () => { lastRecording.current = null; }, onSettled: () => setPending(null) });
  }

  async function toggleMic() {
    if (!sessionId || !s || s.finished || send.isPending) return;
    if (rec.isRecording) {
      const r = await rec.stop();
      if (r) sendRecording(r);
    } else {
      coach.stop(); // the student can interrupt the coach
      rec.start();
    }
  }

  function chooseMode(m: "text" | "voice") {
    if (m === mode) return;
    setMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* private mode */ }
    if (m === "text") {
      coach.stop();
      if (rec.isRecording) rec.stop();
      return;
    }
    // Switching to voice in the middle: the coach repeats its last line aloud, and its next replies are spoken.
    if (sessionId && s && !s.finished && !send.isPending) speakLast.mutate(sessionId, { onSuccess: (r) => coach.play(r.audio_url, r.text) });
  }
  const finish = () => {
    if (sessionId && !end.isPending) end.mutate();
  };

  const scenario = scenarios.data?.find((x) => x.id === scenarioId);
  const title = s?.title ?? scenario?.title ?? scenarioId;
  const icon = scenario?.icon ?? scenarioId;
  if (s?.report) return <Report report={s.report} title={title} onRestart={() => restart()} />;

  const live = send.live;
  const coachState: CoachState = rec.isRecording ? "listening" : coach.speaking ? "speaking" : send.isPending || speakLast.isPending ? "thinking" : "idle";
  const barState: CoachState = coachState === "thinking" && pending ? "idle" : coachState; // "Thinking…" already shows in the chat

  const answers = s?.messages.filter((m) => m.role === "user") ?? [];
  const last = answers[answers.length - 1];
  const creditProblem = send.error && isCreditError(send.error) ? (send.error as ApiError) : null;
  const problem = send.error && !creditProblem ? answerHelp(send.error) : end.error ? endHelp(end.error) : null;

  let body: ReactNode;
  if (!sessionId && !scenarioId) {
    body = <EmptyState title="Start your first conversation" text="Pick a scenario above and your tutor will ask the first question." />;
  } else if (start.error) {
    body = <Problem help={startHelp(start.error)} onRetry={() => scenarioId && begin(scenarioId)} />;
  } else if (session.error) {
    body = <Problem help={loadHelp(session.error)} onRetry={() => session.refetch()} onRestart={() => restart()} />;
  } else if (!s) {
    body = <div className="space-y-4"><Skeleton className="h-20 w-2/3" /><Skeleton className="ml-auto h-20 w-2/3" /></div>;
  } else {
    body = s.messages.map((m) => (
      <Bubble key={m.id} m={m} icon={icon} user={user} onListen={m.role === "assistant" ? () => coach.play(m.audioUrl, m.content) : undefined} />
    ));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-h-[calc(100vh-110px)] flex-col">
        <PageHeader title="AI Chat" subtitle="Have a realistic conversation with your AI tutor. Get instant feedback and improve naturally." />

        <div className="mb-4 grid gap-3 md:grid-cols-[1.3fr_0.8fr_1fr]">
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className="flex w-full items-center gap-3 rounded-2xl bg-peach p-3 text-left">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-peach-deep"><Icon name={icon ?? "briefcase"} /></span>
              <span className="flex-1"><span className="block text-xs text-muted">Scenario</span><span className="font-semibold">{title ?? "Choose a scenario"}</span></span>
              <ChevronDown size={18} />
            </button>
            {scenario?.description && <p className="mt-2 px-1 text-xs text-muted">{scenario.description}</p>}
            {menu && (
              <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-soft">
                {(scenarios.data ?? []).map((sc) => (
                  <li key={sc.id}><button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
                    onClick={() => { setMenu(false); restart(sc.id); }}><span className="block font-medium">{sc.title}</span><span className="block text-xs text-muted">{sc.description}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-mint p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-deep"><ChartNoAxesColumn size={20} /></span>
            <span><span className="block text-xs text-muted">Level</span><span className="font-semibold">{user?.level ?? "—"}</span></span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-black/[0.03] p-2" role="radiogroup" aria-label="Answer mode">
            {(["voice", "text"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => chooseMode(m)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold capitalize", mode === m ? "bg-ink text-white" : "text-muted")}>
                {m === "text" ? <MessageCircle size={16} /> : <Mic size={16} />} {m}
              </button>
            ))}
          </div>
        </div>

        {mode === "voice" && (
          <div className="mb-4">
            <div className="mb-2 flex justify-end">
              <button onClick={toggleAvatar} className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{avatarOn ? "Hide 3D coach" : "Show 3D coach"}</button>
            </div>
            {avatarOn && <CoachAvatar {...coach.avatarProps} />}
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
          {s && (
            <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3 text-sm">
              <span className="text-muted">{plural(answers.length, "answer")}</span>
              {answers.length > 0 && !s.finished && (
                <Button dark={false} onClick={finish} disabled={end.isPending} className="!px-4 !py-2">
                  {end.isPending ? "Preparing your report…" : "End session"}
                </Button>
              )}
            </div>
          )}

          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {body}
            {pending && (
              <>
                {live?.transcript || pending.kind === "text"
                  ? <Bubble m={{ id: "pending", role: "user", content: live?.transcript ?? (pending.kind === "text" ? pending.text : ""), corrections: live?.corrections, status: live?.status }} icon={icon} user={user} />
                  : <Bubble m={{ id: "pending", role: "user", content: `Voice answer (${formatTime(pending.seconds)})`, pending: true }} icon={icon} user={user} />}
                {live?.reply ? (
                  <Bubble m={{ id: "pending-reply", role: "assistant", content: live.reply }} icon={icon} user={user} />
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint"><Icon name={icon ?? "briefcase"} /></span>
                    <VoiceState state="thinking" className="rounded-3xl bg-black/[0.05] px-5 py-4" />
                  </div>
                )}
              </>
            )}
            <div ref={bottom} />
          </div>

          {(problem || creditProblem || rec.error || coach.blocked) && (
            <div className="space-y-2 px-6 pb-2">
              {coach.blocked && (
                <button onClick={() => coach.replayBlocked()} className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-semibold">
                  <Volume2 size={16} /> Tap to hear the coach
                </button>
              )}
              {rec.error && <p role="alert" className="rounded-2xl bg-rose/60 px-4 py-3 text-sm">{rec.error}</p>}
              {creditProblem && <OutOfCredits error={creditProblem} isGuest={isGuest} />}
              {problem && (
                <Problem help={problem} onRestart={() => restart()}
                  onRetry={send.error ? (lastRecording.current ? () => sendRecording(lastRecording.current!) : submit) : finish} />
              )}
            </div>
          )}

          {s?.finished ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4">
              <p className="text-muted">You answered every question.</p>
              <Button onClick={finish} disabled={end.isPending}>{end.isPending ? "Preparing your report…" : "See my report"}</Button>
            </div>
          ) : (
            <div className="border-t border-line">
              {/* The coach's state sits above the field: typing stays possible while it thinks or speaks. */}
              {(barState === "thinking" || barState === "speaking") && (
                <div className="flex items-center justify-between gap-3 px-4 pt-3">
                  <VoiceState state={barState} />
                  {barState === "speaking" && (
                    <button onClick={() => coach.stop()} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-semibold">
                      <Square size={12} /> Stop
                    </button>
                  )}
                </div>
              )}
              <div className="flex items-center gap-4 p-4">
                <div className="flex flex-col items-center">
                  <button onClick={toggleMic} disabled={!s || send.isPending} aria-label={rec.isRecording ? "Stop and send" : "Answer by voice"}
                    className={cn("flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-50", rec.isRecording && "ring-[6px] ring-brand")}>
                    {rec.isRecording ? <Square size={18} /> : <Mic size={22} />}
                  </button>
                  <span className="mt-1 text-[11px] text-muted">{rec.isRecording ? `Tap to send · max ${MAX_RECORDING_S}s` : "Tap to speak"}</span>
                </div>
                {rec.isRecording ? (
                  <VoiceState state="listening" seconds={rec.seconds} className="flex-1" />
                ) : (
                  <div className="flex-1">
                    <input value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                      disabled={!s || send.isPending} placeholder={mode === "voice" ? "Or type your answer…" : "Type your response here…"}
                      className="w-full rounded-full border border-line px-5 py-3.5 outline-none focus:border-ink disabled:bg-black/[0.03]" />
                    <p className="mt-1 text-right text-xs text-muted">{text.length} / {MAX}</p>
                  </div>
                )}
                <button onClick={submit} disabled={!text.trim() || !s || send.isPending || rec.isRecording} aria-label="Send"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"><Send size={20} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="hidden space-y-4 xl:block">
        <Card className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Live corrections</h2>
            {s && !s.finished && <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Active</span>}</div>
          {!last ? (
            <EmptyState title="No corrections yet" text="Send an answer and your tutor will suggest improvements here." />
          ) : last.corrections?.length ? (
            last.corrections.map((c, i) => <CorrectionCard key={i} c={c} />)
          ) : (
            <EmptyState title="Clean answer" text="No correction on your last answer." />
          )}
          {last && <SummaryRow icon={<CircleAlert size={18} />} tone="bg-rose" title="Corrections this turn" sub={plural(last.corrections?.length ?? 0, "suggestion")} />}
        </Card>
      </aside>
    </div>
  );
}

function Problem({ help, onRetry, onRestart }: { help: Help; onRetry?: () => void; onRestart?: () => void }) {
  const small = "!px-3 !py-1.5 text-xs";
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-rose-deep bg-rose/50 p-4 text-sm">
      <CircleAlert className="shrink-0" size={18} />
      <p className="flex-1">{help.text}</p>
      {help.chooseLevel && <Link href="/profile" className="font-semibold underline">Choose my level</Link>}
      {help.retry && onRetry && <Button dark={false} onClick={onRetry} className={small}>Try again</Button>}
      {help.restart && onRestart && <Button dark={false} onClick={onRestart} className={small}>Start a new session</Button>}
    </div>
  );
}

function StatusPill({ status, label }: { status: SentenceStatus; label: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold", STATUS_STYLE[status])}>{label}</span>;
}

function Bubble({ m, icon, user, onListen }: { m: ChatMessage; icon?: string; user?: ReturnType<typeof useCurrentUser>["user"]; onListen?: () => void }) {
  const mine = m.role === "user";
  const time = m.createdAt && new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("flex items-start gap-3", mine && "justify-end")}>
      {!mine && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint"><Icon name={icon ?? "briefcase"} /></span>}
      <div className={cn("max-w-[75%]", mine && "text-right")}>
        <p className={cn("whitespace-pre-wrap rounded-3xl px-5 py-4 text-left", mine ? "bg-mint" : "bg-black/[0.05]", m.pending && "flex items-center gap-2 italic text-muted")}>
          {m.pending && <Mic size={16} aria-hidden />}{m.content}
        </p>
        {mine && !m.pending && m.corrections && m.corrections.length > 0 && <InlineCorrection text={m.content} corrections={m.corrections} />}
        <div className={cn("mt-1 flex items-center gap-2", mine && "justify-end")}>
          {m.status && <StatusPill status={m.status} label={answerLabel(m.status, m.corrections?.length ?? 0)} />}
          {time && <span className="text-xs text-muted">{time}</span>}
          {onListen && (
            <button onClick={onListen} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-muted hover:bg-black/5" aria-label="Listen to this line">
              <Volume2 size={13} /> Listen
            </button>
          )}
        </div>
      </div>
      {mine && <Avatar src={user?.avatarUrl} first={user?.firstName} last={user?.lastName} size={44} />}
    </div>
  );
}

/** DESIGN.md "Correction": right under the student's answer. Line 1 the sentence with each wrong part struck, line 2
 *  the corrected sentence with each fix in bold, then one short explanation per fix (in French by default). */
function InlineCorrection({ text, corrections }: { text: string; corrections: Correction[] }) {
  const { before, after, unplaced } = markSentence(text, corrections);
  return (
    <div className="tk-in ml-auto mt-2 rounded-2xl border border-[color:var(--hairline-soft)] bg-[color:var(--surface)] p-3 text-left text-sm">
      <p className="text-muted">
        {before.map((p, i) => (p.kind === "wrong" ? <s key={i} className="text-[color:var(--bad)]">{p.text}</s> : <span key={i}>{p.text}</span>))}
      </p>
      <p className="mt-0.5 font-medium text-ink">
        {after.map((p, i) => (p.kind === "fixed" ? <span key={i} className="font-semibold text-[color:var(--good)]">{p.text}</span> : <span key={i}>{p.text}</span>))}
      </p>
      {unplaced.map((c, i) => (
        <p key={`u${i}`} className="mt-0.5"><s className="text-[color:var(--bad)]">{c.original}</s> → <span className="font-semibold text-[color:var(--good)]">{c.fixed}</span></p>
      ))}
      <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
        {corrections.map((c, i) => <li key={i}>{c.why}</li>)}
      </ul>
    </div>
  );
}

function CorrectionCard({ c }: { c: Correction }) {
  const grammar = c.type === "grammar";
  return (
    <div className={cn("rounded-2xl p-4", grammar ? "bg-rose" : "bg-butter")}>
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", grammar ? "bg-rose-deep" : "bg-butter-deep")}>
          {grammar ? <CircleAlert size={18} /> : <Lightbulb size={18} />}
        </span>
        {grammar ? "Grammar correction" : "Better phrasing"}
      </p>
      <p className="text-xs font-medium">Your sentence</p>
      <p className="mb-1 rounded-lg bg-rose-deep/60 px-3 py-1.5 text-sm">{c.original}</p>
      <ArrowDown size={14} className="mx-auto my-1" />
      <p className="text-xs font-medium">{grammar ? "Better version" : "More natural"}</p>
      <p className="mb-2 rounded-lg bg-mint-deep/70 px-3 py-1.5 text-sm">{c.fixed}</p>
      <p className="rounded-lg bg-white/60 px-3 py-2 text-xs text-muted">{c.why}</p>
    </div>
  );
}

function SummaryRow({ icon, tone, title, sub }: { icon: React.ReactNode; tone: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone)}>{icon}</span>
      <div className="flex-1"><p className="font-semibold">{title}</p><p className="text-sm text-muted">{sub}</p></div>
      <ChevronRight size={16} />
    </div>
  );
}

function Report({ report, title, onRestart }: { report: SessionReport; title?: string; onRestart: () => void }) {
  const metrics = [
    { label: "Mistakes per 100 words", value: report.metrics.mistakesPer100, level: report.levels.mistakesPer100, missing: "Not available" },
    { label: "Words per answer", value: report.metrics.wordsPerAnswer, level: report.levels.wordsPerAnswer, missing: "Not available" },
    { label: "Hesitations per minute", value: report.metrics.hesitationsPerMin, level: report.levels.hesitationsPerMin, missing: "Voice sessions only" },
  ];
  const speaking = report.metrics.speakingSeconds;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={title} title="Your session report" />
      <Card>
        <h2 className="text-lg font-semibold">Your tutor's note</h2>
        <p className="mt-2 whitespace-pre-wrap">{report.note}</p>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.label}>
            <p className="text-sm text-muted">{m.label}</p>
            <p className="mt-2 text-3xl font-semibold">{formatNumber(m.value)}</p>
            <div className="mt-2">
              {m.level ? <StatusPill status={m.level} label={LEVEL_LABEL[m.level]} /> : m.value === null && <span className="text-sm text-muted">{m.missing}</span>}
            </div>
          </Card>
        ))}
      </div>
      {speaking !== null && <p className="mt-3 text-sm text-muted">Speaking time: {formatMinutes(speaking / 60)}</p>}

      <Card className="mt-4">
        <h2 className="text-lg font-semibold">Your answers</h2>
        <ol className="mt-3 space-y-3">
          {report.lines.map((line, i) =>
            line.role === "coach" ? (
              <li key={i} className="rounded-2xl bg-black/[0.04] px-4 py-3 text-sm">{line.text}</li>
            ) : (
              <li key={i} className={cn("flex gap-3 rounded-2xl border p-3", i === report.redoIndex ? "border-ink" : "border-line")}>
                <span aria-hidden className={cn("w-1 shrink-0 rounded-full", line.status ? STATUS_BAR[line.status] : "bg-line")} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p>{line.text}</p>
                    {line.status && <StatusPill status={line.status} label={answerLabel(line.status, line.corrections.length)} />}
                  </div>
                  {i === report.redoIndex && <p className="text-sm font-semibold">Redo this answer first</p>}
                  {line.corrections.map((c, j) => (
                    <div key={j} className="rounded-2xl border border-line p-3 text-sm">
                      <p><s className="text-[color:var(--bad)]">{c.original}</s></p>
                      <p className="font-semibold text-[color:var(--good)]">{c.fixed}</p>
                      <p className="text-muted">{c.why}</p>
                    </div>
                  ))}
                </div>
              </li>
            ),
          )}
        </ol>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={onRestart}>Practice again</Button>
        <Link href="/practice" className="inline-flex items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-black/5">
          Back to practice
        </Link>
        <InstallButton />
      </div>
    </div>
  );
}
