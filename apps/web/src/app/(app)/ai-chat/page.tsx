"use client";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChartNoAxesColumn, ChevronDown, ChevronRight, CircleAlert, FileText, MessageCircle, Mic, MicOff, PhoneCall, PhoneOff, Send, Square, Volume2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { aiSessionKey, useAiSession, useAnswer, useEndSession, useStartSession } from "@/features/ai-chat/hooks/useAiChat";
import { CoachAvatar } from "@/components/CoachAvatar";
import VoiceState, { formatTime, type CoachState } from "@/features/ai-chat/components/VoiceState";
import { MAX_RECORDING_S, useVoiceRecorder, type Recording } from "@/features/ai-chat/hooks/useVoiceRecorder";
import { useCoachVoice } from "@/features/ai-chat/hooks/useCoachVoice";
import { useRealtimeVoice } from "@/features/ai-chat/hooks/useRealtimeVoice";
import OutOfCredits, { isCreditError } from "@/features/credits/components/OutOfCredits";
import { VoiceCoachView, VoiceCallButton } from "@/features/ai-chat/components/VoiceCoachView";
import CorrectionCard from "@/features/ai-chat/components/CorrectionCard";
import { correctionHistory } from "@/features/ai-chat/lib/correctionHistory";
import { applyVoiceCorrection } from "@/features/ai-chat/lib/voiceCorrection";
import { markSentence } from "@/features/ai-chat/lib/marks";
import type { AiSession, ChatMessage, Correction, SentenceStatus, SessionReport } from "@/features/ai-chat/types/ai";
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
  const qc = useQueryClient();
  const { user, isGuest } = useCurrentUser();
  const scenarios = useScenarios();
  const start = useStartSession();
  const session = useAiSession(sessionId);
  const end = useEndSession(sessionId);
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
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const coach = useCoachVoice(mode === "voice" && avatarOn);
  // Message audio is available through each assistant message's explicit Listen button.
  const send = useAnswer(sessionId, () => undefined);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [rtLive, setRtLive] = useState<{
    transcript?: string;
    reply?: string;
    corrections?: Correction[];
    status?: SentenceStatus;
  } | null>(null);
  const [menu, setMenu] = useState(false);
  const started = useRef<string | null>(null);
  const lastRecording = useRef<Recording | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const transcriptBox = useRef<HTMLDivElement>(null);
  const rec = useVoiceRecorder({ onAutoStop: (r) => r && sendRecording(r) });

  const rtVoice = useRealtimeVoice({
    sessionId,
    onUserTranscript: (userText) => {
      setRtLive({ transcript: userText });
      if (sessionId) {
        qc.setQueryData<AiSession>(aiSessionKey(sessionId), (prev) => {
          if (!prev) return prev;
          const n = prev.messages.length;
          return {
            ...prev,
            messages: [
              ...prev.messages,
              { id: `${prev.id}-${n}`, role: "user", content: userText, createdAt: new Date().toISOString() },
            ],
          };
        });
      }
    },
    onBotTranscript: (botText) => {
      setRtLive((prev) => ({ ...(prev ?? {}), reply: botText }));
      if (sessionId) {
        qc.setQueryData<AiSession>(aiSessionKey(sessionId), (prev) => {
          if (!prev) return prev;
          const n = prev.messages.length;
          return {
            ...prev,
            messages: [
              ...prev.messages,
              { id: `${prev.id}-${n}`, role: "assistant", content: botText, createdAt: new Date().toISOString() },
            ],
          };
        });
        // AI response is played via Pipecat WebRTC pipeline (masculine chatbot voice).
        // Do not call coach.play() here to avoid duplicate/browser TTS playback.
      }
    },
    onCorrection: (data) => {
      setRtLive(null);
      if (sessionId) {
        qc.setQueryData<AiSession>(aiSessionKey(sessionId), (prev) => {
          if (!prev) return prev;
          return applyVoiceCorrection(prev, data);
        });
        // The server saves before emitting this event. Refetching here can overwrite a newer transcript.
      }
    },
    onError: (err) => {
      setVoiceError(err.message);
    },
  });

  const startCall = () => {
    setVoiceError(null);
    coach.stop();
    setRtLive(null);
    void rtVoice.start().catch(() => undefined);
  };

  const begin = (id: string) => {
    started.current = id;
    start.mutate({ scenarioId: id, mode: "text" }, {
      onSuccess: (s) => {
        router.replace(`/ai-chat?sessionId=${encodeURIComponent(s.sessionId)}&scenarioId=${encodeURIComponent(id)}`);
      },
    });
  };

  // Start a backend session when arriving with ?scenarioId=… only (with ?sessionId=…, the session is loaded instead).
  useEffect(() => {
    if (sessionId || !urlScenarioId || started.current === urlScenarioId) return;
    begin(urlScenarioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlScenarioId, sessionId]);

  useEffect(() => {
    if (mode === "voice" && transcriptBox.current) {
      transcriptBox.current.scrollTo({ top: transcriptBox.current.scrollHeight, behavior: "smooth" });
    } else {
      bottom.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [mode, s?.messages.length, pending, send.live?.reply, rtLive?.transcript, rtLive?.reply]);

  /** A new session for this scenario, or for another one. */
  const restart = (id = scenarioId) => {
    setText("");
    setRtLive(null);
    coach.stop();
    rtVoice.stop();
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
    setText("");
    // Keep a newly typed draft intact; restore a failed answer only when the field is empty.
    send.mutate({ text: answer }, { onError: () => setText((draft) => draft || answer), onSettled: () => setPending(null) });
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
      rtVoice.stop();
      if (rec.isRecording) rec.stop();
      return;
    }
  }
  const finish = () => {
    rtVoice.stop();
    if (sessionId && !end.isPending) end.mutate();
  };

  const scenario = scenarios.data?.find((x) => x.id === scenarioId);
  const title = s?.title ?? scenario?.title ?? scenarioId;
  const icon = scenario?.icon ?? scenarioId;
  if (s?.report) return <Report report={s.report} title={title} onRestart={() => restart()} />;

  const live = send.live;
  const coachState: CoachState = rtVoice.isConnected
    ? rtVoice.state
    : rec.isRecording
    ? "listening"
    : coach.speaking
    ? "speaking"
    : send.isPending || rtVoice.isConnecting
    ? "thinking"
    : "idle";
  const barState: CoachState = coachState === "thinking" && pending ? "idle" : coachState; // "Thinking…" already shows in the chat

  const answers = s?.messages.filter((m) => m.role === "user") ?? [];
  const history = correctionHistory(s?.messages ?? []);
  const correctionCount = history.reduce((n, entry) => n + entry.corrections.length, 0);
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
      <div className="flex min-w-0 min-h-[calc(100dvh-160px-env(safe-area-inset-bottom))] md:min-h-[calc(100dvh-110px)] flex-col">
        <PageHeader title="AI Chat" subtitle="Have a realistic conversation with your AI tutor. Get instant feedback and improve naturally." />

        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-[1.3fr_0.8fr_1fr]">
          <div className="relative col-span-2 md:col-span-1">
            <button onClick={() => setMenu((m) => !m)} className="flex w-full items-center gap-3 rounded-2xl bg-peach p-3 text-left">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-peach-deep"><Icon name={icon ?? "briefcase"} /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs text-muted">Scenario</span><span className="font-semibold">{title ?? "Choose a scenario"}</span></span>
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

        <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
        {mode === "voice" && (
          <section aria-label="Voice practice" className="p-5 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
              {answers.length > 0 && s && !s.finished && <Button dark={false} onClick={finish} disabled={end.isPending} className="!px-4 !py-2 text-xs">{end.isPending ? "Preparing your report…" : "End session"}</Button>}
              <button type="button" onClick={toggleAvatar} className="min-h-9 rounded-full border border-line px-3 py-1 text-xs font-semibold">{avatarOn ? "Hide 3D coach" : "Show 3D coach"}</button>
            </div>
            <VoiceCoachView
              avatar={avatarOn ? <div className="w-full max-w-xs overflow-hidden rounded-3xl bg-mint/30"><CoachAvatar {...coach.avatarProps} /></div> : <span className="flex h-40 w-40 items-center justify-center rounded-3xl bg-mint/50 sm:h-52 sm:w-52"><Icon name={icon ?? "speaking"} size={64} className="text-ink/50" /></span>}
              status={rtVoice.isConnecting ? "Requesting microphone and connecting…" : rtVoice.isConnected ? rtVoice.isMuted ? "Microphone muted" : "Connected — speak naturally" : "Start a call, then speak naturally."}>
              {rtVoice.isConnected && <div className="mt-3 flex min-h-9 items-center gap-3">
                <VoiceState state={rtVoice.state} /><span className="text-xs text-muted">{formatTime(rtVoice.duration)}</span>
                {!rtVoice.isMuted && <div className="flex h-8 items-center gap-1" aria-label="Microphone activity">
                  {Array.from({ length: 16 }).map((_, i) => <span key={i} className="w-1 rounded-full bg-mint-deep transition-[height] duration-100" style={{ height: `${Math.max(4, rtVoice.audioLevel * (0.55 + (i % 5) / 5) * 30)}px` }} />)}
                </div>}
              </div>}
              <div className="mt-6 flex w-full items-center justify-center gap-3">
                <VoiceCallButton active={rtVoice.isConnected} connecting={rtVoice.isConnecting} onClick={() => (rtVoice.isConnected || rtVoice.isConnecting) ? rtVoice.stop() : startCall()} disabled={!sessionId || !s || s.finished} />
                {rtVoice.isConnected && <button type="button" onClick={rtVoice.toggleMute} aria-label={rtVoice.isMuted ? "Unmute microphone" : "Mute microphone"} className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line hover:bg-black/5">
                  {rtVoice.isMuted ? <MicOff size={21} /> : <Mic size={21} />}
                </button>}
              </div>
              <p className="mb-3 mt-3 text-xs text-muted">Your microphone is used during the call.</p>
              {voiceError && <p role="alert" className="mt-3 w-full rounded-xl bg-rose/60 px-4 py-3 text-sm">{voiceError}</p>}
            </VoiceCoachView>
          </section>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          {mode !== "voice" && <>
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

          <div ref={transcriptBox} className="max-h-[55dvh] min-h-48 flex-1 space-y-5 overflow-y-auto overscroll-contain p-3 sm:p-6 md:max-h-none">
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
            {rtLive && (
  <>
    {rtLive.transcript && (
      <Bubble
        m={{
          id: "rt-pending-user",
          role: "user",
          content: rtLive.transcript,
          corrections: rtLive.corrections,
          status: rtLive.status,
        }}
        icon={icon}
        user={user}
      />
    )}
    {rtLive.reply ? (
      <Bubble
        m={{
          id: "rt-pending-reply",
          role: "assistant",
          content: rtLive.reply,
        }}
        icon={icon}
        user={user}
      />
    ) : (
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint">
          <Icon name={icon ?? "briefcase"} />
        </span>
        <VoiceState
          state={rtVoice.state === "speaking" ? "speaking" : "thinking"}
          className="rounded-3xl bg-black/[0.05] px-5 py-4"
        />
      </div>
    )}
  </>
)}
            <div ref={bottom} />
          </div>
          </>}

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
          ) : mode === "voice" ? null : (
            <div className="border-t border-line">
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
              <div className="flex items-start gap-2 p-3 sm:gap-4 sm:p-4">
                <div className="flex flex-col items-center">
                  <button onClick={toggleMic} disabled={!s || send.isPending} aria-label={rec.isRecording ? "Stop and send" : "Answer by voice"}
                    className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink sm:h-14 sm:w-14 text-white disabled:opacity-50", rec.isRecording && "ring-[6px] ring-brand")}>
                    {rec.isRecording ? <Square size={18} /> : <Mic size={22} />}
                  </button>
                  <span className="mt-1 max-w-16 text-center text-[10px] text-muted sm:max-w-none sm:text-[11px]">{rec.isRecording ? `Tap to send · max ${MAX_RECORDING_S}s` : "Tap to speak"}</span>
                </div>
                {rec.isRecording ? (
                  <VoiceState state="listening" seconds={rec.seconds} className="flex-1" />
                ) : (
                  <div className="min-w-0 flex-1">
                    <input value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                      disabled={!s} placeholder="Type your response here…"
                      className="w-full rounded-full border border-line px-5 py-3.5 outline-none focus:border-ink disabled:bg-black/[0.03]" />
                    <p className="mt-1 text-right text-xs text-muted">{text.length} / {MAX}</p>
                  </div>
                )}
                <button onClick={submit} disabled={!text.trim() || !s || send.isPending || rec.isRecording} aria-label="Send"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink sm:h-14 sm:w-14 text-white disabled:opacity-40"><Send size={20} /></button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      <aside className="min-w-0" aria-label="Live corrections">
        <Card className="space-y-4 xl:sticky xl:top-6">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">Live corrections</h2>
            {s && !s.finished && <span className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full bg-success" /> Enabled</span>}</div>
          <p className="text-xs text-muted">Corrections stay here throughout this session.</p>
          {history.length === 0 ? (
            <div className="rounded-2xl bg-lilac/20 px-5 py-8 text-center">
              <FileText size={34} strokeWidth={1.3} aria-hidden="true" className="mx-auto mb-4 text-[#9280CB]/40" />
              <p className="font-semibold">No corrections yet</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{mode === "voice" ? "Speak during a call to see suggestions here." : "Send an answer to see suggestions here."}</p>
            </div>
          ) : (
            <ol className="max-h-[65dvh] space-y-5 overflow-y-auto pr-1" aria-label="Session corrections" aria-live="polite" aria-relevant="additions">
              {history.map((entry) => <li key={entry.messageId}>
                <h3 className="mb-2 text-xs font-medium text-muted">Answer {entry.answerNumber}</h3>
                <div className="space-y-3">{entry.corrections.map((c, i) => <CorrectionCard key={i} c={c} />)}</div>
              </li>)}
            </ol>
          )}
          {correctionCount > 0 && <SummaryRow icon={<CircleAlert size={18} />} tone="bg-rose" title="Corrections this session" sub={plural(correctionCount, "suggestion")} />}
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
      <p className="min-w-0 flex-1">{help.text}</p>
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


function SummaryRow({ icon, tone, title, sub }: { icon: React.ReactNode; tone: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tone)}>{icon}</span>
      <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-sm text-muted">{sub}</p></div>
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
      </div>
    </div>
  );
}
