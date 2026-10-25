"use client";
import { useEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { Mic, MicOff } from "lucide-react";
import { VoiceCallButton, VoiceCoachView } from "./VoiceCoachView";
import VoiceState, { formatTime, type CoachState } from "./VoiceState";
import { cn } from "@/lib/utils";
import type { CallPhase } from "../hooks/useRealtimeVoice";
import type { CallError } from "../lib/call";
import type { Correction, SentenceStatus } from "../types/ai";

/**
 * The call screen: designed by Wad2o (PR #110), enhanced after a design critique. His identity is kept: the big coach tile,
 * "Your AI tutor", the mint microphone strip, the pill call button, the rose End call. What was added after a design critique (23/40):
 * - live captions (the question, what the student said, the correction): the conversation is no longer hidden;
 * - one status line that always names whose turn it is, instead of a fixed "Connected" that contradicted "Speaking…";
 * - no layout shift (the End session row is reserved), text from 14 px, a neutral Cancel, a quiet live region;
 * - a refused microphone offers text; Mute says what it is; the strip stays flat while the coach speaks.
 */
export default function CallScreen({ phase, state, muted, seconds, levelRef, tile, coachLine, heard, heardFixes, heardStatus, scenarioTitle, error, disabled, preparing, endSession, onStart, onStop, onMute, onUseText, onUseVoiceMessage }: {
  phase: CallPhase; state: CoachState; muted: boolean; seconds: number; levelRef: MutableRefObject<number>;
  /** The coach tile: compact while the call is on, so the captions have room on a small phone. */
  tile: (opts: { compact: boolean; speaking: boolean }) => ReactNode;
  coachLine?: string; heard?: string; heardFixes?: Correction[]; heardStatus?: SentenceStatus | null; scenarioTitle?: string;
  error: CallError | null; disabled?: boolean; preparing?: boolean; endSession?: ReactNode;
  onStart: () => void; onStop: () => void; onMute: () => void; onUseText: () => void; onUseVoiceMessage: () => void;
}) {
  const connected = phase === "live";
  const connecting = phase === "connecting";
  const speaking = connected && state === "speaking";
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    if (!connected) return;
    let frame = 0;
    const tick = () => {
      // Flat while muted, and while the coach talks (the line is deaf then: a moving strip would say "you are heard" when you are not).
      const level = muted || speaking ? 0 : levelRef.current * 2.4;
      bars.current.forEach((el, i) => { if (el) el.style.transform = `scaleY(${Math.max(0.12, Math.min(1, level * (0.55 + (i % 5) / 5)))})`; });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [connected, muted, speaking, levelRef]);

  const yourTurn = connected && !muted && state === "idle";
  const micProblem = error?.kind === "mic-denied";
  const announce = connecting ? "Connecting the call" : muted && connected ? "Microphone muted" : yourTurn ? "Your turn" : "";

  const status = connecting
    ? <VoiceState state="thinking" label="Allow the microphone if asked, then connecting…" large quiet className="justify-center" />
    : connected
      ? muted
        ? <p className="flex items-center justify-center gap-2"><MicOff size={18} aria-hidden className="shrink-0 text-bad" />Microphone muted</p>
        : yourTurn
          ? <p className="flex items-center justify-center gap-2"><span className="tk-breathe h-3 w-3 shrink-0 rounded-full bg-good-fill" aria-hidden />Your turn: speak when you are ready</p>
          : <VoiceState state={state} label={state === "listening" ? "Listening…" : undefined} large quiet className="justify-center" />
      : "Start a call, then speak naturally.";

  return (
    <section aria-label="Voice practice" className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8">
      <VoiceCoachView avatar={tile({ compact: connected || connecting, speaking })} subtitle={scenarioTitle} status={status}>
        {connected && (
          <div className="mt-2 flex min-h-9 items-center justify-center gap-3">
            <span className="w-10 text-sm tabular-nums text-slate">{formatTime(seconds)}</span>
            <div role="img" aria-label="Microphone level" className="flex h-8 items-center gap-1">
              {Array.from({ length: 16 }).map((_, i) => <span key={i} ref={(el) => { bars.current[i] = el; }} className={cn("h-8 w-1 rounded-full", muted ? "bg-stone" : "bg-mint-deep")} style={{ transform: "scaleY(0.12)" }} />)}
            </div>
          </div>
        )}

        {/* Captions: the conversation stays readable on the call screen. Height reserved, nothing jumps when a line arrives. */}
        {(coachLine || heard) && (
          <div className="mt-4 min-h-[7rem] w-full space-y-2 text-left" aria-label="What was said" role="group">
            {coachLine && <p className="rounded-2xl bg-mint/40 px-4 py-3 text-base leading-snug"><span className="mb-0.5 block text-sm font-semibold text-slate">Coach</span>{coachLine}</p>}
            {heard && <p className="px-1 text-sm text-slate"><span className="font-semibold">You said: </span>{heard}</p>}
            {heardFixes && heardFixes.length > 0
              ? <p className="rounded-2xl bg-butter/70 px-4 py-2 text-sm"><span className="font-semibold">{heardFixes.length === 1 ? "1 correction" : `${heardFixes.length} corrections`}: </span>“{heardFixes[0].original}” → “{heardFixes[0].fixed}”</p>
              : heardStatus === "green" && <p className="inline-block rounded-full bg-good-bg px-3 py-1 text-sm font-semibold text-good">Clean answer</p>}
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 w-full space-y-3 rounded-2xl bg-rose/60 p-4 text-left text-sm">
            <p>{error.message}</p>
            {error.kind !== "no-credits" && (
              <button type="button" onClick={micProblem ? onUseText : onUseVoiceMessage} className="inline-flex min-h-11 items-center rounded-full border border-ink bg-white px-5 font-semibold transition-transform active:scale-[0.98]">
                {micProblem ? "Type your answers instead" : "Use a voice message"}
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex w-full items-center justify-center gap-3">
          <VoiceCallButton active={connected} connecting={connecting} onClick={() => (connected || connecting ? onStop() : onStart())} disabled={disabled || (preparing && !connected)} />
          {connected && (
            <button type="button" onClick={onMute} aria-pressed={muted} aria-label="Mute microphone"
              className={cn("flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full border border-line px-4 text-sm font-semibold transition-transform active:scale-95 hover:bg-black/5", muted && "bg-bad-bg text-bad")}>
              {muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
              <span className="max-[359px]:sr-only">{muted ? "Muted" : "Mute"}</span>
            </button>
          )}
        </div>
        {!connected && !connecting && <p className="mt-3 text-sm text-slate">{preparing ? "Getting the call ready…" : "Your microphone is used during the call. Corrections appear here as you speak."}</p>}
        <div className="mt-4 flex min-h-11 w-full items-center justify-center">{endSession}</div>
        <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      </VoiceCoachView>
    </section>
  );
}
