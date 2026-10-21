"use client";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ChartNoAxesColumn, Check, ChevronDown, ChevronRight, CircleAlert, Lightbulb, MessageCircle, Mic, Send, Square, TrendingUp, UserRound, Volume2 } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { useAiSession, useAnswer, useEndSession, useExplainNote, useSpeakLastLine, useStartSession } from "@/features/ai-chat/hooks/useAiChat";
import { useUpdateProfile } from "@/features/profile/hooks/useProfile";
import ExplainToggle from "@/features/ai-chat/components/ExplainToggle";
import VerdictCard from "@/features/ai-chat/components/VerdictCard";
import type { ExplainLang } from "@/features/auth/types/user";
import { CoachAvatar } from "@/components/CoachAvatar";
import InstallButton from "@/components/InstallButton";
import GuestSaveNote from "@/components/GuestSaveNote";
import VoiceState, { formatTime, type CoachState } from "@/features/ai-chat/components/VoiceState";
import HelpMeStart from "@/features/ai-chat/components/HelpMeStart";
import ConfidenceAsk from "@/features/ai-chat/components/ConfidenceAsk";
import SayItAgain from "@/features/ai-chat/components/SayItAgain";
import { useVoiceRecorder, type Recording } from "@/features/ai-chat/hooks/useVoiceRecorder";
import { maxRecordingSeconds } from "@/features/ai-chat/lib/voice";
import { useCoachVoice } from "@/features/ai-chat/hooks/useCoachVoice";
import OutOfCredits, { isCreditError } from "@/features/credits/components/OutOfCredits";
import { markSentence } from "@/features/ai-chat/lib/marks";
import { feedbackView } from "@/features/ai-chat/lib/feedback";
import { freezeView, thinkSeconds } from "@/features/ai-chat/lib/freeze";
import { confidenceLine, shouldAskBefore } from "@/features/ai-chat/lib/confidence";
import { MODE_LABEL, feedbackModeFrom, modeHint } from "@/features/ai-chat/lib/mode";
import type { ChatMessage, Correction, SentenceStatus, SessionReport } from "@/features/ai-chat/types/ai";
import { Avatar, Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { startHref } from "@/components/cards";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/lib/icons";
import { scenarioTint } from "@/lib/tint";
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
  // Improvement 3: the mode of a running session wins; a new one takes it from the link (?mode=interview).
  const feedbackMode = s?.feedbackMode ?? feedbackModeFrom(params.get("mode"));
  const interview = feedbackMode === "interview";

  // "Explain in English / French": starts from the profile, applies from the next answer, and is kept for the next sessions.
  const [explain, setExplain] = useState<ExplainLang>("fr");
  const explainTouched = useRef(false);
  const saveProfile = useUpdateProfile();
  useEffect(() => { if (user && !explainTouched.current) setExplain(user.explainLang); }, [user]);
  const chooseExplain = (lang: ExplainLang) => { explainTouched.current = true; setExplain(lang); saveProfile.mutate({ explainLang: lang }); };

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
  const answerField = useRef<HTMLInputElement>(null);
  // Freeze meter: when the coach's question was done, and when the student started (first sound or first letter).
  const questionDone = useRef<{ line: string; at: number | null }>({ line: "", at: null });
  const began = useRef<number | null>(null);
  const [nailed, setNailed] = useState<Set<string>>(() => new Set()); // answers said again correctly
  const [skippedConfidence, setSkippedConfidence] = useState(false);
  const maxSeconds = maxRecordingSeconds(scenarioId);
  const rec = useVoiceRecorder({ onAutoStop: (r) => r && sendRecording(r), maxSeconds });

  const begin = (id: string) => {
    started.current = id;
    // The session starts as text so the first question shows at once; in voice mode its audio is asked right after
    // (POST /speak, which also makes the session a voice session): the student reads it while the voice is made.
    start.mutate({ scenarioId: id, mode: "text", feedbackMode }, {
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

  // The first question stays at the top; while an answer is processed the log follows it; once the coach has replied the
  // log shows the student's answer first (its compliment and its fix), not the end of the page.
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    if ((s?.messages.length ?? 0) <= 1 && !pending) { log.scrollTo({ top: 0 }); return; }
    if (pending || send.live) { bottom.current?.scrollIntoView({ behavior: "smooth" }); return; }
    const mine = log.querySelectorAll<HTMLElement>('[data-role="user"]');
    mine[mine.length - 1]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [s?.messages.length, pending, send.live]);

  /** A new session for this scenario, or for another one. */
  const restart = (id = scenarioId) => {
    setText("");
    coach.stop();
    send.reset();
    end.reset();
    if (!id) return router.push("/practice");
    if (!sessionId && id === urlScenarioId) return begin(id);
    started.current = null;
    router.replace(startHref(id, feedbackMode));
  };

  const submit = () => {
    const answer = text.trim();
    if (!answer || !sessionId || !s || s.finished || send.isPending) return;
    coach.stop();
    setPending({ kind: "text", text: answer });
    // The answer shows in the chat at once, so the field empties; if it fails, it comes back to be sent again.
    setText("");
    send.mutate({ text: answer, explain, think: thinkSeconds(questionDone.current.at, began.current) }, { onError: () => setText((t) => t || answer), onSettled: () => setPending(null) });
  };

  function sendRecording(r: Recording) {
    lastRecording.current = r;
    setPending({ kind: "voice", seconds: r.seconds });
    send.mutate({ audio: r.blob, explain, think: thinkSeconds(questionDone.current.at, began.current) }, { onSuccess: () => { lastRecording.current = null; }, onSettled: () => setPending(null) });
  }

  async function toggleMic() {
    if (!sessionId || !s || s.finished || send.isPending) return;
    if (rec.isRecording) {
      const r = await rec.stop();
      if (r) sendRecording(r);
    } else {
      coach.stop(); // the student can interrupt the coach
      began.current ??= Date.now();
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
  const tint = scenarioTint(scenario?.category);
  // Freeze meter: a new coach line starts a new wait, counted from the moment the coach is done talking. (Before the
  // report's early return: hooks cannot come after it.)
  const lastLineId = [...(s?.messages ?? [])].reverse().find((m) => m.role === "assistant")?.id ?? "";
  const coachBusy = rec.isRecording || coach.speaking || send.isPending || speakLast.isPending || !!pending;
  useEffect(() => {
    if (questionDone.current.line !== lastLineId) { questionDone.current = { line: lastLineId, at: null }; began.current = null; }
    if (!coachBusy && questionDone.current.at === null && lastLineId && !s?.finished) questionDone.current.at = Date.now();
  }, [lastLineId, coachBusy, s?.finished]);

  if (s?.report) return <Report report={s.report} title={title} sessionId={sessionId} explainDefault={explain} onRestart={() => restart()} />;

  const live = send.live;
  const coachState: CoachState = rec.isRecording ? "listening" : coach.speaking ? "speaking" : send.isPending || speakLast.isPending ? "thinking" : "idle";
  const barState: CoachState = coachState === "thinking" && pending ? "idle" : coachState; // "Thinking…" already shows in the chat

  const answers = s?.messages.filter((m) => m.role === "user") ?? [];
  const lastCoachLine = [...(s?.messages ?? [])].reverse().find((m) => m.role === "assistant");
  const last = answers[answers.length - 1];
  const creditProblem = send.error && isCreditError(send.error) ? (send.error as ApiError) : null;
  const problem = send.error && !creditProblem ? answerHelp(send.error) : end.error ? endHelp(end.error) : null;

  let body: ReactNode;
  if (!sessionId && !scenarioId) {
    body = <EmptyState title="Start your first conversation" text="Pick a scenario above and your coach will ask the first question." />;
  } else if (start.error) {
    body = <Problem help={startHelp(start.error)} onRetry={() => scenarioId && begin(scenarioId)} />;
  } else if (session.error) {
    body = <Problem help={loadHelp(session.error)} onRetry={() => session.refetch()} onRestart={() => restart()} />;
  } else if (!s) {
    body = <div className="space-y-4"><Skeleton className="h-20 w-2/3" /><Skeleton className="ml-auto h-20 w-2/3" /></div>;
  } else {
    const answerIndex = new Map(s.messages.filter((m) => m.role === "user").map((m, i) => [m.id, i]));
    body = s.messages.map((m) => (
      <Bubble key={m.id} m={m} icon={icon} tint={tint} user={user} nailed={nailed.has(m.id)}
        onListen={m.role === "assistant" ? () => coach.play(m.audioUrl, m.content) : undefined}
        sayItAgain={m.role === "user" && sessionId && m.corrections?.length ? (
          <SayItAgain sessionId={sessionId} turn={answerIndex.get(m.id) ?? 0} disabled={rec.isRecording || send.isPending}
            onStart={() => coach.stop()} onNailed={() => setNailed((prev) => new Set(prev).add(m.id))} />
        ) : undefined} />
    ));
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* On a phone, once the session runs, the chat is one screen between the app header and the bottom bar: only the
          conversation scrolls, the header, the settings and the answer field stay where they are. (66 px header + 8 px
          padding above, 61 px bar below; the paddings the shell keeps under the page are cancelled by -mb.) */}
      <div className={cn("flex min-w-0 flex-col md:min-h-[calc(100vh-110px)]",
        s && "max-md:-mb-[120px] max-md:h-[calc(100dvh-135px-env(safe-area-inset-bottom))]")}>
        <div className={s ? "hidden md:block" : undefined}>
          <PageHeader title="Practice session" subtitle={s ? undefined : "Answer by voice or by typing. Your coach corrects each answer and explains why."} />
        </div>

        {s ? (
          <>
        {/* During an interview the settings shrink to one line, so the question and the answer field fit a phone. */}
        <div className="relative mb-2 flex shrink-0 flex-nowrap items-center gap-2 md:mb-3 md:flex-wrap">
          <button onClick={() => setMenu((m) => !m)} aria-expanded={menu}
            className={cn("inline-flex min-h-11 min-w-0 shrink items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold", tint)}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70"><Icon name={icon ?? "briefcase"} size={16} /></span>
            <span className="truncate">{title}</span><span className="sr-only">, change scenario</span>
            <ChevronDown size={16} className="shrink-0" aria-hidden />
          </button>
          {/* One toggle: how the student answers. The only status shown is the real interview (a state, not a control). */}
          <div className="ml-auto inline-flex shrink-0 rounded-full bg-surface p-0.5" role="radiogroup" aria-label="Answer mode">
            {(["voice", "text"] as const).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} onClick={() => chooseMode(m)}
                className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold capitalize", mode === m ? "bg-ink text-white" : "text-muted")}>
                <span className="hidden sm:inline-flex">{m === "text" ? <MessageCircle size={15} aria-hidden /> : <Mic size={15} aria-hidden />}</span> {m}
              </button>
            ))}
          </div>
          {menu && (
              <ul className="absolute left-0 top-full z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-soft">
                {(scenarios.data ?? []).map((sc) => (
                  <li key={sc.id}><button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
                    onClick={() => { setMenu(false); restart(sc.id); }}><span className="block font-medium">{sc.title}</span><span className="block text-sm text-muted">{sc.description}</span></button></li>
                ))}
              </ul>
            )}
        </div>
        {interview && <p className="-mt-1 mb-3 shrink-0 text-sm text-charcoal"><span className="font-semibold">{MODE_LABEL.interview}.</span> {modeHint("interview")}</p>}
        {mode === "voice" && avatarOn && <div className="mb-4"><CoachAvatar {...coach.avatarProps} /></div>}

          </>
        ) : (
          <>
        <div className="mb-4 grid gap-3 md:grid-cols-[1.3fr_0.8fr_1fr]">
          <div className="relative">
            <button onClick={() => setMenu((m) => !m)} className={cn("flex w-full items-center gap-3 rounded-2xl p-3 text-left", tint)}>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/70"><Icon name={icon ?? "briefcase"} /></span>
              <span className="flex-1"><span className="block text-sm text-charcoal">Scenario</span><span className="font-semibold">{title ?? "Choose a scenario"}</span></span>
              <ChevronDown size={18} />
            </button>
            {scenario?.description && <p className="mt-2 px-1 text-sm text-muted">{scenario.description}</p>}
            {menu && (
              <ul className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-white p-1.5 shadow-soft">
                {(scenarios.data ?? []).map((sc) => (
                  <li key={sc.id}><button className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5"
                    onClick={() => { setMenu(false); restart(sc.id); }}><span className="block font-medium">{sc.title}</span><span className="block text-sm text-muted">{sc.description}</span></button></li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-surface p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white"><ChartNoAxesColumn size={20} /></span>
            <span><span className="block text-sm text-muted">Level</span><span className="font-semibold">{user?.level ?? "—"}</span></span>
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
              <button onClick={toggleAvatar} className="relative min-h-11 rounded-full border border-line px-3 text-sm font-semibold">{avatarOn ? "Hide 3D coach" : "Show 3D coach"}</button>
            </div>
            {avatarOn && <CoachAvatar {...coach.avatarProps} />}
          </div>
        )}

          </>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
          {s && (
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2 text-sm md:px-6 md:py-3">
              <span className="hidden whitespace-nowrap text-muted md:inline">{plural(answers.length, "answer")}</span>
              {answers.length > 0 && !s.finished && (
                <Button dark={false} onClick={finish} disabled={end.isPending} aria-label="End session" className="order-2 ml-auto !min-h-11 !px-4 !py-2 md:order-3 md:ml-0">
                  {end.isPending ? "Preparing your report…" : <><span className="max-[359px]:hidden">End session</span><span className="hidden max-[359px]:inline">End</span></>}
                </Button>
              )}
              {/* On a phone the language toggle gets its own line under the count and the End button. */}
              <ExplainToggle value={explain} onChange={chooseExplain} className="order-1 md:order-2 md:ml-auto" />
              {mode === "voice" && (
                <button onClick={toggleAvatar} className="order-4 hidden min-h-11 items-center rounded-full px-2 text-sm font-medium text-steel underline underline-offset-2 md:inline-flex">
                  {avatarOn ? "Hide 3D coach" : "Show 3D coach"}
                </button>
              )}
            </div>
          )}

          <div ref={logRef} role="log" aria-label="Conversation" className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 md:p-6">
            {body}
            {sessionId && s && shouldAskBefore(answers.length, skippedConfidence) && !pending && (
              <ConfidenceAsk sessionId={sessionId} when="before" question="How confident do you feel about this interview?"
                value={s.confidence.before} onSkip={() => setSkippedConfidence(true)} />
            )}
            {pending && (
              <>
                {live?.transcript || pending.kind === "text"
                  ? <Bubble m={{ id: "pending", role: "user", content: live?.transcript ?? (pending.kind === "text" ? pending.text : ""), corrections: live?.corrections, status: live?.status, praise: live?.praise, priorityIndex: live?.priorityIndex }} icon={icon} tint={tint} user={user} />
                  : <Bubble m={{ id: "pending", role: "user", content: `Voice answer (${formatTime(pending.seconds)})`, pending: true }} icon={icon} tint={tint} user={user} />}
                {live?.reply ? (
                  <Bubble m={{ id: "pending-reply", role: "assistant", content: live.reply }} icon={icon} tint={tint} user={user} />
                ) : (
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full", tint)}><Icon name={icon ?? "briefcase"} /></span>
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
              {rec.error && <p role="alert" className="rounded-2xl bg-bad-bg px-4 py-3 text-sm">{rec.error}</p>}
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
            <div className="shrink-0 border-t border-line">
              {/* The coach's state sits above the field: typing stays possible while it thinks or speaks. */}
              {(barState === "thinking" || barState === "speaking") && (
                <div className="flex items-center justify-between gap-3 px-4 pt-3">
                  <VoiceState state={barState} />
                  {barState === "speaking" && (
                    <button onClick={() => coach.stop()} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold">
                      <Square size={12} /> Stop
                    </button>
                  )}
                </div>
              )}
              {sessionId && s && !interview && (
                <HelpMeStart sessionId={sessionId} question={lastCoachLine?.content} questionKey={lastCoachLine?.id ?? "start"} typing={text.trim().length > 0}
                  recording={rec.isRecording} busy={coachState === "thinking" || coachState === "speaking" || !!pending}
                  onUse={(t) => { setText(t); answerField.current?.focus(); }} />
              )}
              <div className="flex items-center gap-3 p-3 sm:p-4">
                <div className="flex flex-col items-center">
                  <button onClick={toggleMic} disabled={!s || send.isPending} aria-label={rec.isRecording ? "Stop and send" : "Answer by voice"}
                    className={cn("flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-50", rec.isRecording && "ring-[6px] ring-brand")}>
                    {rec.isRecording ? <Square size={18} /> : <Mic size={22} />}
                  </button>
                  <span className="mt-1 text-sm text-muted">{rec.isRecording ? `Tap to send · max ${maxSeconds}s` : "Tap to speak"}</span>
                </div>
                {rec.isRecording ? (
                  <VoiceState state="listening" seconds={rec.seconds} className="flex-1" />
                ) : (
                  <div className="flex-1">
                    <input ref={answerField} value={text} maxLength={MAX} onChange={(e) => { if (e.target.value && began.current === null) began.current = Date.now(); setText(e.target.value); }} onKeyDown={(e) => e.key === "Enter" && submit()}
                      disabled={!s || send.isPending} aria-label="Your answer" placeholder="Type here"
                      className="w-full rounded-full border border-line px-3.5 py-3.5 outline-none focus:border-ink disabled:bg-black/[0.03]" />
                    <p className={cn("mt-1 text-right text-sm text-muted", text.length < 400 && "max-md:hidden")}>{text.length} / {MAX}</p>
                  </div>
                )}
                <button onClick={submit} disabled={!text.trim() || !s || send.isPending || rec.isRecording} aria-label="Send"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"><Send size={20} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className={cn("hidden space-y-4", interview ? "" : "xl:block")}>
        <Card className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Live corrections</h2>
            {s && !s.finished && <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-good" /> Active</span>}</div>
          {!last ? (
            <EmptyState title="No corrections yet" text="Send an answer and your coach will suggest improvements here." />
          ) : last.corrections?.length ? (
            last.corrections.map((c, i) => <CorrectionCard key={i} c={c} />)
          ) : (
            <EmptyState title="Clean answer" text="No correction on your last answer." />
          )}
          {last && <SummaryRow icon={<CircleAlert size={18} />} tone="bg-warn-bg" title="Corrections this turn" sub={plural(last.corrections?.length ?? 0, "suggestion")} />}
        </Card>
      </aside>
    </div>
  );
}

function Problem({ help, onRetry, onRestart }: { help: Help; onRetry?: () => void; onRestart?: () => void }) {
  const small = "!px-4 text-sm";
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-bad-bg p-4 text-sm">
      <CircleAlert className="shrink-0 text-bad" size={18} />
      <p className="flex-1">{help.text}</p>
      {help.chooseLevel && <Link href="/profile" className="font-semibold underline">Choose my level</Link>}
      {help.retry && onRetry && <Button dark={false} onClick={onRetry} className={small}>Try again</Button>}
      {help.restart && onRestart && <Button dark={false} onClick={onRestart} className={small}>Start a new session</Button>}
    </div>
  );
}

function StatusPill({ status, label }: { status: SentenceStatus; label: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[13px] font-semibold", STATUS_STYLE[status])}>{label}</span>;
}

function Bubble({ m, icon, tint, user, onListen, sayItAgain, nailed }: {
  m: ChatMessage; icon?: string; tint?: string; user?: ReturnType<typeof useCurrentUser>["user"]; onListen?: () => void;
  sayItAgain?: ReactNode; nailed?: boolean;
}) {
  const mine = m.role === "user";
  const { isGuest: guest } = useCurrentUser(); // a guest has no name: a neutral icon, not "GU"
  const time = m.createdAt && new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div data-role={m.role} className={cn("flex items-start gap-3", mine && "justify-end")}>
      {!mine && <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-full max-sm:hidden", tint ?? "bg-surface")}><Icon name={icon ?? "briefcase"} /></span>}
      <div className={cn("max-w-[90%] sm:max-w-[75%]", mine && "text-right")}>
        <p className={cn("whitespace-pre-wrap rounded-3xl px-4 py-3 text-left sm:px-5 sm:py-4", mine ? "bg-ink text-white" : "bg-black/[0.05]", m.pending && "flex items-center gap-2 italic text-white/70")}>
          {m.pending && <Mic size={16} aria-hidden />}{m.content}
        </p>
        {mine && !m.pending && ((m.corrections?.length ?? 0) > 0 || m.praise) && (
          <InlineCorrection text={m.content} corrections={m.corrections ?? []} praise={m.praise} priorityIndex={m.priorityIndex} />
        )}
        {mine && !m.pending && sayItAgain}
        <div className={cn("mt-1 flex items-center gap-2", mine && "justify-end")}>
          {m.status && (nailed
            ? <StatusPill status="green" label="Nailed it" />
            : <StatusPill status={m.status} label={answerLabel(m.status, m.corrections?.length ?? 0)} />)}
          {time && <span className="text-sm text-muted">{time}</span>}
          {onListen && (
            <button onClick={onListen} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-muted hover:bg-black/5" aria-label="Listen to this line">
              <Volume2 size={13} /> Listen
            </button>
          )}
        </div>
      </div>
      {mine && (guest
        ? <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/[0.06] max-sm:hidden" aria-hidden><UserRound size={20} /></span>
        : <span className="max-sm:hidden"><Avatar src={user?.avatarUrl} first={user?.firstName} last={user?.lastName} size={44} /></span>)}
    </div>
  );
}

/** DESIGN.md "Correction": right under the student's answer. Line 1 the sentence with each wrong part struck, line 2
 *  the corrected sentence with each fix in bold, then one short explanation per fix (in French by default). */
function Fix({ c }: { c: Correction }) {
  return (
    <div className="mt-1.5">
      {/* Red is kept for "Redo" (docs/JURY_BRIEF.md, improvement 4): a small mistake is struck in gray. */}
      <p><s className="text-steel">{c.original}</s> → <span className="font-semibold text-[color:var(--good)]">{c.fixed}</span></p>
      <p className="text-sm text-muted">{c.why}</p>
    </div>
  );
}

function InlineCorrection({ text, corrections, praise, priorityIndex = 0 }: {
  text: string; corrections: Correction[]; praise?: string | null; priorityIndex?: number;
}) {
  const { after } = markSentence(text, corrections);
  const { priority, others, moreLabel } = feedbackView(corrections, priorityIndex);
  return (
    <div className="tk-in ml-auto mt-2 rounded-2xl border border-[color:var(--hairline-soft)] bg-[color:var(--surface)] p-3 text-left text-sm">
      {praise && (
        <p className="flex items-start gap-1.5 font-medium text-[color:var(--good)]">
          <Check size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>{praise}</span>
        </p>
      )}
      {priority && <Fix c={priority} />}
      {others.length > 0 && (
        <details className="mt-1">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-ink">{moreLabel}</summary>
          {others.map((c, i) => <Fix key={i} c={c} />)}
        </details>
      )}
      {priority && (
        <p className="mt-2 border-t border-[color:var(--hairline-soft)] pt-2 font-medium text-ink">
          <span className="font-normal text-slate">Say it: </span>
          {after.map((p, i) => (p.kind === "fixed" ? <span key={i} className="font-semibold text-[color:var(--good)]">{p.text}</span> : <span key={i}>{p.text}</span>))}
        </p>
      )}
    </div>
  );
}

function CorrectionCard({ c }: { c: Correction }) {
  const grammar = c.type === "grammar";
  return (
    <div className={cn("rounded-2xl p-4", grammar ? "bg-warn-bg" : "bg-surface")}>
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
          {grammar ? <CircleAlert size={18} /> : <Lightbulb size={18} />}
        </span>
        {grammar ? "Grammar correction" : "Better phrasing"}
      </p>
      <p className="text-sm font-medium">Your sentence</p>
      <p className="mb-1 rounded-lg bg-white px-3 py-1.5 text-sm">{c.original}</p>
      <ArrowDown size={14} className="mx-auto my-1" />
      <p className="text-sm font-medium">{grammar ? "Better version" : "More natural"}</p>
      <p className="mb-2 rounded-lg bg-good-bg px-3 py-1.5 text-sm">{c.fixed}</p>
      <p className="rounded-lg bg-white px-3 py-2 text-sm text-muted">{c.why}</p>
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

function Report({ report, title, sessionId, explainDefault, onRestart }: { report: SessionReport; title?: string; sessionId?: string; explainDefault: ExplainLang; onRestart: () => void }) {
  const { isGuest } = useCurrentUser();
  // The note comes in the language of the session; the other one is written on demand (nothing is saved, nothing is spent).
  const [lang, setLang] = useState<ExplainLang>(explainDefault);
  const [notes, setNotes] = useState<Partial<Record<ExplainLang, string>>>({ [explainDefault]: report.note });
  const explainNote = useExplainNote(sessionId);
  const changeLang = (l: ExplainLang) => {
    setLang(l);
    if (!notes[l] && sessionId) explainNote.mutate(l, { onSuccess: (r) => setNotes((n) => ({ ...n, [l]: r.note })) });
  };
  const metrics = [
    { label: "Mistakes per 100 words", value: report.metrics.mistakesPer100, level: report.levels.mistakesPer100, missing: "Not available" },
    { label: "Words per answer", value: report.metrics.wordsPerAnswer, level: report.levels.wordsPerAnswer, missing: "Not available" },
    // Hesitations exist only for spoken answers: no empty card for a typed session.
    ...(report.metrics.hesitationsPerMin === null ? [] : [{ label: "Hesitations per minute", value: report.metrics.hesitationsPerMin, level: report.levels.hesitationsPerMin, missing: "" }]),
  ];
  const redo = report.redoIndex !== null ? report.lines[report.redoIndex] : undefined;
  const speaking = report.metrics.speakingSeconds;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow={`${title ?? ""} · ${MODE_LABEL[report.feedbackMode]}`} title="Your session report" />
      {report.feedbackMode === "interview" && <VerdictCard verdict={report.verdict} lang={lang} redoIndex={report.redoIndex} />}
      {report.progress && (
        <p className="mb-4 flex items-start gap-2 rounded-2xl bg-good-bg px-4 py-3 font-medium text-good">
          <TrendingUp size={20} className="mt-0.5 shrink-0" aria-hidden /> <span>{report.progress}</span>
        </p>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold">Your coach&apos;s note</h2>
          {sessionId && <ExplainToggle value={lang} onChange={changeLang} label="Explain in" disabled={explainNote.isPending} />}
        </div>
        <p className="mt-2 whitespace-pre-wrap">{notes[lang] ?? (explainNote.isPending ? "Writing the note…" : report.note)}</p>
        {explainNote.isError && !notes[lang] && (
          <p role="alert" className="mt-2 text-sm text-bad">The note could not be written in {lang === "en" ? "English" : "French"}. Pick the language again to retry.</p>
        )}
      </Card>

      {redo && (
        <p className="mt-4 rounded-2xl bg-surface px-4 py-3">
          <span className="font-semibold">Work on this one first: </span>
          <a href="#redo-answer" className="inline-block break-words py-3 underline underline-offset-2">“{redo.text}”</a>
        </p>
      )}

      {report.freeze && (() => {
        const v = freezeView(report.freeze);
        return (
          <Card className="mt-4">
            <p className="text-sm text-muted">{v.title}</p>
            <p className="mt-2 text-3xl font-semibold">{v.value}</p>
            {v.note && <p className="mt-2 text-sm text-charcoal">{v.note}</p>}
          </Card>
        );
      })()}

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
      {sessionId && (
        <div className="mt-4 space-y-2">
          {confidenceLine(report.confidence) && (
            // Green only when the student really feels more confident: a drop is told neutrally.
            <p className={cn("rounded-2xl px-4 py-3 font-medium", (report.confidence.after ?? 0) > (report.confidence.before ?? 0) ? "bg-good-bg text-good" : "bg-surface text-charcoal")}>{confidenceLine(report.confidence)}</p>
          )}
          <ConfidenceAsk sessionId={sessionId} when="after" question="How confident do you feel now?" value={report.confidence.after} />
        </div>
      )}
      {speaking !== null && <p className="mt-3 text-sm text-muted">Speaking time: {formatMinutes(speaking / 60)}</p>}

      <Card className="mt-4">
        <h2 className="text-lg font-semibold">Your answers</h2>
        <ol className="mt-1 divide-y divide-line">
          {report.lines.map((line, i) =>
            line.role === "coach" ? (
              <li key={i} className="py-3 text-sm text-slate">{line.text}</li>
            ) : (
              <li key={i} id={i === report.redoIndex ? "redo-answer" : undefined} className="flex scroll-mt-4 gap-3 py-4">
                <span aria-hidden className={cn("w-1 shrink-0 rounded-full", line.status ? STATUS_BAR[line.status] : "bg-line")} />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="break-words">{line.text}</p>
                    {line.status && <StatusPill status={line.status} label={answerLabel(line.status, line.corrections.length)} />}
                  </div>
                  {i === report.redoIndex && <p className="text-sm font-semibold">Work on this answer first</p>}
                  {line.corrections.map((c, j) => (
                    <p key={j} className="break-words text-sm">
                      <s className="text-steel">{c.original}</s> → <span className="font-semibold text-[color:var(--good)]">{c.fixed}</span>
                      <span className="mt-0.5 block text-slate">{c.why}</span>
                    </p>
                  ))}
                </div>
              </li>
            ),
          )}
        </ol>
      </Card>

      {isGuest && <GuestSaveNote className="mt-6" />}
      <p className="mt-6 text-slate">You finished one interview. Five minutes tomorrow keeps it going.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button onClick={onRestart}>Practice again</Button>
        <Link href="/practice" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-black/5">
          Back to practice
        </Link>
        <InstallButton />
      </div>
    </div>
  );
}
