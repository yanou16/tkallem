"use client";
import type { MutableRefObject, ReactNode } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import VoiceState, { formatTime, type CoachState } from "./VoiceState";
import MicMeter from "./MicMeter";
import { cn } from "@/lib/utils";
import type { CallError } from "../lib/call";
import type { CallPhase } from "../hooks/useRealtimeVoice";

/**
 * Where the answer field is in the other modes. Before the call it says what a call is; while connecting it says what
 * the browser is about to ask; while live it shows who the coach is, whose turn it is, and that the microphone hears
 * the student. When the call cannot connect, the way out is one tap away: the voice message, or text when the
 * microphone itself is the problem (the voice message needs it too).
 */
export default function CallPanel({ phase, state, muted, seconds, levelRef, avatar, error, disabled, preparing, onStart, onStop, onMute, onUseVoiceMessage, onUseText }: {
  phase: CallPhase; state: CoachState; muted: boolean; seconds: number; levelRef: MutableRefObject<number>; avatar: ReactNode;
  error: CallError | null; disabled?: boolean; preparing?: boolean;
  onStart: () => void; onStop: () => void; onMute: () => void; onUseVoiceMessage: () => void; onUseText: () => void;
}) {
  if (phase === "idle") {
    const micProblem = error?.kind === "mic-denied";
    return (
      <div className="space-y-3 p-4">
        {error && (
          <div role="alert" className="space-y-3 rounded-2xl bg-bad-bg p-4 text-sm">
            <p>{error.message}</p>
            {error.kind !== "no-credits" && (
              <button onClick={micProblem ? onUseText : onUseVoiceMessage} className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 font-semibold transition-transform active:scale-[0.98]">
                {micProblem ? "Type your answers instead" : "Use a voice message"}
              </button>
            )}
          </div>
        )}
        <button onClick={onStart} disabled={disabled}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-ink px-6 text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50">
          <Phone size={20} aria-hidden /> {preparing ? "Getting the call ready…" : micProblem ? "Retry once the microphone is allowed" : error ? "Try the call again" : "Start the call"}
        </button>
        {!error && <p className="text-center text-sm text-slate">Tap Start and allow the microphone. Speak when it is your turn: the coach answers out loud, and your corrections appear in the chat.</p>}
      </div>
    );
  }
  if (phase === "connecting") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <VoiceState state="thinking" label="Allow the microphone if asked, then connecting…" large />
        <button onClick={onStop} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold transition-transform active:scale-[0.98]">Cancel</button>
      </div>
    );
  }

  // Live. One headline says whose turn it is; the shape beside it (bars, dots, circle) says it without reading.
  const yourTurn = state === "idle" && !muted;
  const headline = muted ? "Microphone muted" : state === "listening" ? "Listening…" : undefined;
  // Read aloud only when the student has something to do: a call changes state every few seconds, over the coach's voice.
  const announce = muted ? "Microphone muted" : yourTurn ? "Your turn" : "";
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <span className={cn("inline-flex shrink-0 rounded-full", state === "speaking" && "tk-breathe")}>{avatar}</span>
        <div className="min-w-0 flex-1">
          {yourTurn
            ? <p className="flex items-center gap-2 text-base font-semibold"><span className="tk-breathe h-3 w-3 shrink-0 rounded-full bg-good-fill" aria-hidden />Your turn: speak when you are ready</p>
            : muted
              ? <p className="flex items-center gap-2 text-base font-semibold"><MicOff size={18} aria-hidden className="shrink-0 text-bad" />{headline}</p>
              : <VoiceState state={state} label={headline} large quiet />}
          <p className="mt-0.5 text-sm text-slate tabular-nums">On the call · {formatTime(seconds)}</p>
        </div>
      </div>
      <MicMeter levelRef={levelRef} muted={muted} className="justify-center" />
      <div className="flex items-center gap-3">
        <button onClick={onMute} aria-pressed={muted} aria-label="Mute microphone"
          className={cn("flex size-12 shrink-0 items-center justify-center rounded-full border border-line transition-transform active:scale-95", muted && "bg-bad-bg text-bad")}>
          {muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
        </button>
        <button onClick={onStop}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-bad px-5 text-base font-semibold text-white transition-transform active:scale-[0.98]">
          <PhoneOff size={18} aria-hidden /> End call
        </button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}
