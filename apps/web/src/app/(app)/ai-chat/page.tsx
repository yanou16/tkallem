"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ChevronDown, ChevronRight, CircleAlert, Lightbulb, Mic, MessageCircle, Send, Square, ChartNoAxesColumn, Volume2 } from "lucide-react";
import OutOfCredits, { isCreditError } from "@/features/credits/components/OutOfCredits";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { CoachAvatar } from "@/components/CoachAvatar";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { useAiSession, useCreateSession, useEndSession, useSessionReport, useSpeakLastLine, useTurn } from "@/features/ai-chat/hooks/useAiChat";
import SessionReportView from "@/features/ai-chat/components/SessionReportView";
import VoiceState, { formatTime, type CoachState } from "@/features/ai-chat/components/VoiceState";
import { MAX_RECORDING_S, useVoiceRecorder, type Recording } from "@/features/ai-chat/hooks/useVoiceRecorder";
import { useCoachVoice } from "@/features/ai-chat/hooks/useCoachVoice";
import type { ChatMessage, Correction } from "@/features/ai-chat/types/ai";
import { Avatar, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

const MAX = 500;
const MODE_KEY = "tkallem.mode";

/** Voice first (it is a speaking coach); the student's last choice is remembered on this device. */
function readMode(): "text" | "voice" {
  try {
    return localStorage.getItem(MODE_KEY) === "text" ? "text" : "voice";
  } catch {
    return "voice";
  }
}

export default function AiChatPage() {
  return <Suspense fallback={<Skeleton className="mt-6 h-96" />}><Chat /></Suspense>;
}

type Pending = { kind: "text"; text: string } | { kind: "voice"; seconds: number };

function Chat() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? undefined;
  const scenarioId = params.get("scenarioId") ?? undefined;
  const { user, activeLanguage, isGuest } = useCurrentUser();
  const scenarios = useScenarios();
  const create = useCreateSession();
  const session = useAiSession(sessionId);
  const end = useEndSession(sessionId);
  const speakLast = useSpeakLastLine(sessionId);
  const report = useSessionReport(sessionId).data;

  const [mode, setMode] = useState<"text" | "voice">(readMode);
  const [avatarOn, setAvatarOn] = useState(true);
  const coach = useCoachVoice(mode === "voice" && avatarOn);
  // The coach's voice is played as soon as it arrives, while the corrections are still being written.
  const turn = useTurn(sessionId, (url, line) => coach.play(url, line));
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [menu, setMenu] = useState(false);
  const started = useRef<string | null>(null);
  const lastRecording = useRef<Recording | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const rec = useVoiceRecorder({ onAutoStop: (r) => r && sendRecording(r) });

  // Start a backend session when arriving with ?scenarioId=… (&again=… from the report starts a new one)
  const startKey = `${scenarioId}:${params.get("again") ?? ""}`;
  useEffect(() => {
    if (sessionId || !scenarioId || started.current === startKey) return;
    started.current = startKey;
    create.mutate(
      { scenario_id: scenarioId, mode, explain_lang: user?.explainLang ?? "fr" },
      {
        onSuccess: (s) => {
          if (mode === "voice") coach.play(s.first_question.audio_url, s.first_question.text); // the coach asks out loud
          router.replace(`/ai-chat?sessionId=${s.session_id}&scenarioId=${scenarioId}`);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, sessionId]);

  const s = session.data;
  // An old link (session of another account, or removed): start the same scenario again instead of a dead end.
  const lost = session.error instanceof ApiError && session.error.status === 404;
  useEffect(() => {
    if (lost && scenarioId) {
      started.current = null;
      router.replace(`/ai-chat?scenarioId=${scenarioId}`);
    }
  }, [lost, scenarioId, router]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [s?.messages.length, pending]);

  const busy = turn.isPending || end.isPending;
  const answered = s?.messages.filter((m) => m.role === "user").length ?? 0;
  const closed = !!report || !!s?.ended; // no more answers once the report is made
  const coachState: CoachState = rec.isRecording ? "listening" : coach.speaking ? "speaking" : turn.isPending || speakLast.isPending ? "thinking" : "idle";
  const barState: CoachState = coachState === "thinking" && pending ? "idle" : coachState; // "Thinking…" already shows in the chat

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
    if (sessionId && s && !closed && !busy) speakLast.mutate(undefined, { onSuccess: (r) => coach.play(r.audio_url, r.text) });
  }

  function submit() {
    const msg = text.trim();
    if (!msg || !sessionId || busy || closed) return;
    setText("");
    coach.stop();
    setPending({ kind: "text", text: msg });
    turn.mutate({ text: msg }, {
      onError: () => setText(msg), // the answer is not lost: it goes back in the field
      onSettled: () => setPending(null),
    });
  }

  function sendRecording(r: Recording) {
    lastRecording.current = r;
    setPending({ kind: "voice", seconds: r.seconds });
    turn.mutate({ audio: r.blob }, {
      onSuccess: () => { lastRecording.current = null; },
      onSettled: () => setPending(null),
    });
  }

  async function toggleMic() {
    if (!sessionId || closed || busy) return;
    if (rec.isRecording) {
      const r = await rec.stop();
      if (r) sendRecording(r);
    } else {
      coach.stop(); // the student can interrupt the coach
      rec.start();
    }
  }

  const grammar = useMemo(() => [...(s?.corrections ?? [])].reverse().find((c) => c.type === "grammar"), [s?.corrections]);
  const phrasing = useMemo(() => [...(s?.corrections ?? [])].reverse().find((c) => c.type !== "grammar"), [s?.corrections]);
  const title = s?.scenarioTitle ?? scenarios.data?.find((x) => x.id === scenarioId)?.title;
  const icon = scenarios.data?.find((x) => x.id === scenarioId)?.icon;
  const roleNote = scenarios.data?.find((x) => x.id === scenarioId)?.description;
  const answerError = turn.error;
  const live = turn.live;

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
            {roleNote && <p className="mt-2 px-1 text-xs text-muted">{roleNote}</p>}
            {menu && (
              <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-soft">
                {(scenarios.data ?? []).map((sc) => (
                  <li key={sc.id}><button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
                    onClick={() => { setMenu(false); started.current = null; coach.stop(); router.replace(`/ai-chat?scenarioId=${sc.id}`); }}><span className="block font-medium">{sc.title}</span><span className="block text-xs text-muted">{sc.description}</span></button></li>
                ))}
                {scenarios.data?.length === 0 && <li className="px-3 py-2 text-sm text-muted">No scenarios available</li>}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-mint p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-deep"><ChartNoAxesColumn size={20} /></span>
            <span><span className="block text-xs text-muted">Level</span><span className="font-semibold">{activeLanguage?.level ?? "—"}</span></span>
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
              <button onClick={() => { coach.stop(); setAvatarOn((v) => !v); }} className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{avatarOn ? "Hide 3D coach" : "Show 3D coach"}</button>
            </div>
            {avatarOn && <CoachAvatar {...coach.avatarProps} />}
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {create.error ? <ErrorState error={create.error} onRetry={() => { started.current = null; router.refresh(); }} />
              : !sessionId && !scenarioId ? <EmptyState title="Start your first conversation" text="Pick a scenario above and your AI tutor will begin the conversation." />
              : (create.isPending || session.isLoading) ? <div className="space-y-4"><Skeleton className="h-20 w-2/3" /><Skeleton className="ml-auto h-20 w-2/3" /></div>
              : lost ? <EmptyState title="This conversation is no longer available" text={scenarioId ? "Starting it again…" : "Pick a scenario to start a new one."} action={scenarioId ? undefined : <a href="/practice" className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">Choose a scenario</a>} />
              : session.error ? <ErrorState error={session.error} onRetry={() => session.refetch()} />
              : report ? <SessionReportView report={report} scenarioId={s?.scenarioId ?? scenarioId} />
              : s?.messages.map((m) => <Bubble key={m.id} m={m} icon={icon} user={user} onListen={m.role === "assistant" ? () => coach.play(m.audioUrl, m.content) : undefined} />)}

            {pending && !report && (
              <>
                {live?.transcript || pending.kind === "text"
                  ? <Bubble m={{ id: "pending", role: "user", content: live?.transcript ?? (pending.kind === "text" ? pending.text : "") }} icon={icon} user={user} />
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

            {s && !report && answered > 0 && !s.ended && !pending && (
              <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4", s.finished ? "bg-mint" : "bg-black/[0.03]")}>
                <p className="text-sm">{s.finished ? "Interview complete. Well done!" : "You can stop here and get your report."}</p>
                <button onClick={() => { coach.stop(); end.mutate(); }} disabled={end.isPending || busy}
                  className={cn("rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-50", s.finished ? "bg-ink text-white" : "border border-line bg-white")}>
                  {end.isPending ? "Writing your report…" : s.finished ? "See my report" : "End and see my report"}
                </button>
              </div>
            )}
            {end.error && <ErrorState error={end.error} onRetry={() => end.mutate()} />}
            {s?.ended && !report && (
              <EmptyState title="This session is finished" text="Start the scenario again to practise more." action={<a href={`/ai-chat?scenarioId=${s.scenarioId ?? scenarioId}`} className="inline-block rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white">Practise again</a>} />
            )}
            <div ref={bottom} />
          </div>

          {(answerError || rec.error || coach.blocked) && (
            <div className="space-y-2 px-6 pb-2">
              {coach.blocked && (
                <button onClick={() => coach.replayBlocked()} className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-sm font-semibold">
                  <Volume2 size={16} /> Tap to hear the coach
                </button>
              )}
              {rec.error && <p role="alert" className="rounded-2xl bg-rose/60 px-4 py-3 text-sm">{rec.error}</p>}
              {answerError && (isCreditError(answerError)
                ? <OutOfCredits error={answerError as ApiError} isGuest={isGuest} />
                : (
                  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose/60 px-4 py-3 text-sm">
                    <span><span className="font-semibold">Your answer was not sent.</span> {(answerError as Error).message}</span>
                    {lastRecording.current && <button onClick={() => sendRecording(lastRecording.current!)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white">Send again</button>}
                  </div>
                ))}
            </div>
          )}

          <div className="flex items-center gap-4 border-t border-line p-4">
            <div className="flex flex-col items-center">
              <button onClick={toggleMic} disabled={!sessionId || closed || busy} aria-label={rec.isRecording ? "Stop and send" : "Answer by voice"}
                className={cn("flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-50", rec.isRecording && "ring-[6px] ring-brand")}>
                {rec.isRecording ? <Square size={18} /> : <Mic size={22} />}
              </button>
              <span className="mt-1 text-[11px] text-muted">{rec.isRecording ? `Tap to send · max ${MAX_RECORDING_S}s` : "Tap to speak"}</span>
            </div>
            {barState !== "idle" ? (
              <VoiceState state={barState} seconds={rec.seconds} className="flex-1" />
            ) : (
              <div className="flex-1">
                <input value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                  disabled={!sessionId || closed || busy} placeholder={closed ? "Session finished" : mode === "voice" ? "Or type your answer…" : "Type your response here…"} className="w-full rounded-full border border-line px-5 py-3.5 outline-none focus:border-ink disabled:bg-black/[0.03]" />
                <p className="mt-1 text-right text-xs text-muted">{text.length} / {MAX}</p>
              </div>
            )}
            {coachState === "speaking" ? (
              <button onClick={() => coach.stop()} aria-label="Stop the coach" className="flex h-14 w-14 items-center justify-center rounded-full border border-line"><Square size={18} /></button>
            ) : (
              <button onClick={submit} disabled={!text.trim() || busy || !sessionId || closed || coachState !== "idle"} aria-label="Send" className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"><Send size={20} /></button>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Live corrections</h2>
            {sessionId && <span className="flex items-center gap-2 text-sm"><span className={cn("h-2.5 w-2.5 rounded-full", closed ? "bg-black/30" : "bg-success")} /> {closed ? "Finished" : "Active"}</span>}</div>
          {!grammar && !phrasing && <EmptyState title="No corrections yet" text="Send a message and your tutor will suggest improvements here." />}
          {grammar && <CorrectionCard c={grammar} tone="rose" title="Grammar correction" icon={<CircleAlert size={18} />} better="Better version" />}
          {phrasing && <CorrectionCard c={phrasing} tone="butter" title="Better phrasing" icon={<Lightbulb size={18} />} better="More natural" />}
          <SummaryRow icon={<CircleAlert size={18} />} tone="bg-rose" title="Corrections in this session" sub={`${s?.corrections.length ?? 0} suggestion${(s?.corrections.length ?? 0) === 1 ? "" : "s"}`} />
        </Card>
      </aside>
    </div>
  );
}

function Bubble({ m, icon, user, onListen }: { m: ChatMessage; icon?: string; user?: ReturnType<typeof useCurrentUser>["user"]; onListen?: () => void }) {
  const mine = m.role === "user";
  const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className={cn("flex items-start gap-3", mine && "justify-end")}>
      {!mine && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint"><Icon name={icon ?? "briefcase"} /></span>}
      <div className={cn("max-w-[75%]", mine && "text-right")}>
        <p className={cn("whitespace-pre-wrap rounded-3xl px-5 py-4 text-left", mine ? "bg-mint" : "bg-black/[0.05]", m.pending && "flex items-center gap-2 italic text-muted")}>
          {m.pending && <Mic size={16} aria-hidden />}{m.content}
        </p>
        <span className="flex items-center gap-3 text-xs text-muted">
          {time}
          {onListen && (
            <button onClick={onListen} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 hover:bg-black/5" aria-label="Listen to this line">
              <Volume2 size={13} /> Listen
            </button>
          )}
        </span>
      </div>
      {mine && <Avatar src={user?.avatarUrl} first={user?.firstName} last={user?.lastName} size={44} />}
    </div>
  );
}

function CorrectionCard({ c, tone, title, icon, better }: { c: Correction; tone: "rose" | "butter"; title: string; icon: React.ReactNode; better: string }) {
  return (
    <div className={cn("rounded-2xl p-4", tone === "rose" ? "bg-rose" : "bg-butter")}>
      <p className="mb-3 flex items-center gap-2 font-semibold"><span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone === "rose" ? "bg-rose-deep" : "bg-butter-deep")}>{icon}</span>{title}</p>
      <p className="text-xs font-medium">Your sentence</p>
      <p className="mb-1 rounded-lg bg-rose-deep/60 px-3 py-1.5 text-sm">{c.original}</p>
      <ArrowDown size={14} className="mx-auto my-1" />
      <p className="text-xs font-medium">{better}</p>
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
