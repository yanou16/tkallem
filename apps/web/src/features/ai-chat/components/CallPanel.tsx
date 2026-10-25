"use client";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import VoiceState, { formatTime, type CoachState } from "./VoiceState";
import { cn } from "@/lib/utils";
import type { CallError } from "../lib/call";
import type { CallPhase } from "../hooks/useRealtimeVoice";

/**
 * Where the answer field is in the other modes. Before the call it says what a call is; while connecting it says so;
 * while live it shows whose turn it is. When the call cannot connect, the way out is one tap away: the voice message.
 */
export default function CallPanel({ phase, state, muted, seconds, error, disabled, onStart, onStop, onMute, onUseVoiceMessage }: {
  phase: CallPhase; state: CoachState; muted: boolean; seconds: number; error: CallError | null; disabled?: boolean;
  onStart: () => void; onStop: () => void; onMute: () => void; onUseVoiceMessage: () => void;
}) {
  if (phase === "idle") {
    return (
      <div className="space-y-3 p-4">
        {error && (
          <div role="alert" className="space-y-3 rounded-2xl bg-bad-bg p-4 text-sm">
            <p>{error.message}</p>
            {error.kind !== "no-credits" && (
              <button onClick={onUseVoiceMessage} className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 font-semibold">Use a voice message</button>
            )}
          </div>
        )}
        <button onClick={onStart} disabled={disabled}
          className="flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-ink px-6 text-base font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-50">
          <Phone size={20} aria-hidden /> {error ? "Try the call again" : "Start the call"}
        </button>
        {!error && <p className="text-center text-sm text-slate">Your microphone will open. Speak naturally; the coach answers out loud each time you stop.</p>}
      </div>
    );
  }
  if (phase === "connecting") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <VoiceState state="thinking" label="Connecting the call…" />
        <button onClick={onStop} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-semibold">Cancel</button>
      </div>
    );
  }
  const label = state === "idle" ? "Your turn: speak when you are ready" : undefined;
  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        {label
          ? <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium"><span className="tk-breathe h-3 w-3 shrink-0 rounded-full bg-good-fill" aria-hidden />{label}</p>
          : <VoiceState state={state} />}
        <p className="mt-1 text-sm text-slate tabular-nums">On the call · {formatTime(seconds)}</p>
      </div>
      <button onClick={onMute} aria-pressed={muted} aria-label={muted ? "Unmute the microphone" : "Mute the microphone"}
        className={cn("flex size-12 items-center justify-center rounded-full border border-line transition-transform active:scale-95", muted && "bg-bad-bg text-bad")}>
        {muted ? <MicOff size={20} aria-hidden /> : <Mic size={20} aria-hidden />}
      </button>
      <button onClick={onStop} aria-label="End the call"
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition-transform active:scale-[0.98]">
        <PhoneOff size={18} aria-hidden /> End call
      </button>
    </div>
  );
}
