"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ChevronDown, ChevronRight, CircleAlert, Lightbulb, Mic, MessageCircle, Send, Square, ChartNoAxesColumn } from "lucide-react";
import OutOfCredits, { isCreditError } from "@/features/credits/components/OutOfCredits";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useScenarios } from "@/features/practice/hooks/usePractice";
import { useAiSession, useCreateSession, useSendMessage, useSendVoice } from "@/features/ai-chat/hooks/useAiChat";
import { useVoiceRecorder } from "@/features/ai-chat/hooks/useVoiceRecorder";
import type { ChatMessage, Correction, VoiceState } from "@/features/ai-chat/types/ai";
import { Avatar, Card, EmptyState, ErrorState, PageHeader, Skeleton } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

const MAX = 500;

export default function AiChatPage() {
  return <Suspense fallback={<Skeleton className="mt-6 h-96" />}><Chat /></Suspense>;
}

function Chat() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? undefined;
  const scenarioId = params.get("scenarioId") ?? undefined;
  const { user, activeLanguage, isGuest } = useCurrentUser();
  const scenarios = useScenarios();
  const create = useCreateSession();
  const session = useAiSession(sessionId);
  const send = useSendMessage(sessionId);
  const voice = useSendVoice(sessionId);
  const rec = useVoiceRecorder();

  const [mode, setMode] = useState<"text" | "voice">("text");
  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [menu, setMenu] = useState(false);
  const started = useRef<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // Start a backend session when arriving with ?scenarioId=…
  useEffect(() => {
    if (sessionId || !scenarioId || started.current === scenarioId) return;
    started.current = scenarioId;
    create.mutate(
      { scenario_id: scenarioId, mode, explain_lang: user?.explainLang ?? "fr" },
      { onSuccess: (s) => router.replace(`/ai-chat?sessionId=${s.session_id}&scenarioId=${scenarioId}`) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, sessionId]);

  const s = session.data;
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [s?.messages.length]);

  const voiceState: VoiceState = rec.error ? "error" : rec.isRecording ? "recording" : voice.isPending ? "uploading" : speaking ? "speaking" : voice.isError ? "error" : "idle";
  const busy = send.isPending || voice.isPending;

  function submit() {
    const msg = text.trim();
    if (!msg || !sessionId || busy) return;
    setText("");
    send.mutate({ text: msg });
  }
  async function toggleMic() {
    if (!sessionId) return;
    if (rec.isRecording) {
      const blob = await rec.stop();
      if (blob) voice.mutate(blob, { onSuccess: (r) => {
        if (r.reply_audio_url) { const a = new Audio(r.reply_audio_url); setSpeaking(true); a.onended = a.onerror = () => setSpeaking(false); a.play().catch(() => setSpeaking(false)); }
      } });
    } else rec.start();
  }

  const grammar = useMemo(() => [...(s?.corrections ?? [])].reverse().find((c) => c.type === "grammar"), [s?.corrections]);
  const phrasing = useMemo(() => [...(s?.corrections ?? [])].reverse().find((c) => c.type !== "grammar"), [s?.corrections]);
  const title = s?.scenarioTitle ?? scenarios.data?.find((x) => x.id === scenarioId)?.title;
  const icon = scenarios.data?.find((x) => x.id === scenarioId)?.icon;
  const roleNote = scenarios.data?.find((x) => x.id === scenarioId)?.description;

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
                    onClick={() => { setMenu(false); started.current = null; router.replace(`/ai-chat?scenarioId=${sc.id}`); }}><span className="block font-medium">{sc.title}</span><span className="block text-xs text-muted">{sc.description}</span></button></li>
                ))}
                {scenarios.data?.length === 0 && <li className="px-3 py-2 text-sm text-muted">No scenarios available</li>}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-mint p-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mint-deep"><ChartNoAxesColumn size={20} /></span>
            <span><span className="block text-xs text-muted">Level</span><span className="font-semibold">{activeLanguage?.level ?? "—"}</span></span>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-black/[0.03] p-2">
            {(["text", "voice"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold capitalize", mode === m ? "bg-ink text-white" : "text-muted")}>
                {m === "text" ? <MessageCircle size={16} /> : <Mic size={16} />} {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
          <div className="flex-1 space-y-5 overflow-y-auto p-6" aria-live="polite">
            {create.error ? <ErrorState error={create.error} onRetry={() => { started.current = null; router.refresh(); }} />
              : !sessionId && !scenarioId ? <EmptyState title="Start your first conversation" text="Pick a scenario above and your AI tutor will begin the conversation." />
              : (create.isPending || session.isLoading) ? <div className="space-y-4"><Skeleton className="h-20 w-2/3" /><Skeleton className="ml-auto h-20 w-2/3" /></div>
              : session.error ? <ErrorState error={session.error} onRetry={() => session.refetch()} />
              : s && s.messages.length === 0 ? <EmptyState title="Say hello to begin" text="Type or record your first message." />
              : s?.messages.map((m) => <Bubble key={m.id} m={m} icon={icon} user={user} />)}
            {(send.isPending || voice.isPending) && <p className="text-sm text-muted">Your tutor is replying…</p>}
            <div ref={bottom} />
          </div>

          {(send.error || voice.error || rec.error) && (
            <div className="px-6 pb-2">
              {isCreditError(send.error ?? voice.error)
                ? <OutOfCredits error={(send.error ?? voice.error) as ApiError} isGuest={isGuest} />
                : <ErrorState error={send.error ?? voice.error ?? new Error(rec.error ?? "")} />}
            </div>
          )}

          <div className="flex items-center gap-4 border-t border-line p-4">
            <div className="flex flex-col items-center">
              <button onClick={toggleMic} disabled={!sessionId || voiceState === "uploading"} aria-label={rec.isRecording ? "Stop recording" : "Start recording"}
                className={cn("flex h-14 w-14 items-center justify-center rounded-full text-white disabled:opacity-50", rec.isRecording ? "bg-red-500" : "bg-ink")}>
                {rec.isRecording ? <Square size={18} /> : <Mic size={22} />}
              </button>
              <span className="mt-1 text-[11px] text-muted">{VOICE_LABEL[voiceState]}</span>
            </div>
            <Waveform active={voiceState === "recording" || voiceState === "speaking"} />
            <div className="flex-1">
              <input value={text} maxLength={MAX} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
                disabled={!sessionId} placeholder="Type your response here…" className="w-full rounded-full border border-line px-5 py-3.5 outline-none focus:border-ink disabled:bg-black/[0.03]" />
              <p className="mt-1 text-right text-xs text-muted">{text.length} / {MAX}</p>
            </div>
            <button onClick={submit} disabled={!text.trim() || busy || !sessionId} aria-label="Send" className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"><Send size={20} /></button>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <Card className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Live corrections</h2>
            {sessionId && <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Active</span>}</div>
          {!grammar && !phrasing && <EmptyState title="No corrections yet" text="Send a message and your tutor will suggest improvements here." />}
          {grammar && <CorrectionCard c={grammar} tone="rose" title="Grammar correction" icon={<CircleAlert size={18} />} better="Better version" />}
          {phrasing && <CorrectionCard c={phrasing} tone="butter" title="Better phrasing" icon={<Lightbulb size={18} />} better="More natural" />}
          <SummaryRow icon={<CircleAlert size={18} />} tone="bg-rose" title="Corrections this turn" sub={`${s?.corrections.length ?? 0} suggestions`} />
        </Card>
      </aside>
    </div>
  );
}

const VOICE_LABEL: Record<VoiceState, string> = {
  idle: "Click to speak", recording: "Recording… tap to stop", uploading: "Uploading…", processing: "Processing…", speaking: "Tutor speaking", error: "Try again",
};

function Bubble({ m, icon, user }: { m: ChatMessage; icon?: string; user?: ReturnType<typeof useCurrentUser>["user"] }) {
  const mine = m.role === "user";
  const time = new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className={cn("flex items-start gap-3", mine && "justify-end")}>
      {!mine && <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mint"><Icon name={icon ?? "briefcase"} /></span>}
      <div className={cn("max-w-[75%]", mine && "text-right")}>
        <p className={cn("whitespace-pre-wrap rounded-3xl px-5 py-4 text-left", mine ? "bg-mint" : "bg-black/[0.05]")}>{m.content}</p>
        <span className="text-xs text-muted">{time}</span>
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

function Waveform({ active }: { active: boolean }) {
  // Decorative only: bars are static unless the mic/audio is genuinely active.
  return (
    <div className="hidden h-10 items-center gap-[3px] md:flex" aria-hidden>
      {Array.from({ length: 22 }).map((_, i) => (
        <span key={i} className={cn("w-[3px] rounded-full bg-black/25", active && "animate-pulse")} style={{ height: 6 + ((i * 7) % 5) * 5 }} />
      ))}
    </div>
  );
}
