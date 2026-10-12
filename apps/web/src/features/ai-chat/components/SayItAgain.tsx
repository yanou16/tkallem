"use client";
import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useRepeat } from "../hooks/useAiChat";
import { useVoiceRecorder, type Recording } from "../hooks/useVoiceRecorder";
import { repeatView, triesText, type RepeatView } from "../lib/repeat";

type Props = {
  sessionId: string;
  turn: number; // which answer (0 = first)
  disabled?: boolean; // an answer is being recorded or sent
  onNailed: () => void; // the answer's chip turns green: "Nailed it"
  onStart?: () => void; // stops the coach's voice, so the microphone does not hear it
};

/** "Say it again" (docs/JURY_BRIEF.md, improvement 2): under a correction, the student says the corrected sentence
 *  out loud. The server decides by code if it matches; the interview does not move on. 3 tries per answer. */
export default function SayItAgain({ sessionId, turn, disabled, onNailed, onStart }: Props) {
  const repeat = useRepeat(sessionId);
  const [view, setView] = useState<RepeatView | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  const send = (r: Recording | null) => {
    if (!r) return; // too short or silent: the recorder says why
    repeat.mutate({ turn, audio: r.blob }, {
      onSuccess: (res) => {
        const v = repeatView(res);
        setView(v);
        setLeft(res.tries_left);
        if (v.nailed) onNailed();
      },
      onError: (e) => { if (e instanceof ApiError && e.status === 429) setLeft(0); },
    });
  };
  const rec = useVoiceRecorder({ onAutoStop: send });

  if (view?.nailed) return null; // the answer's chip now says "Nailed it"
  const toggle = async () => {
    if (rec.isRecording) return send(await rec.stop());
    rec.clearError();
    repeat.reset();
    onStart?.();
    rec.start();
  };
  const problem = rec.error ?? repeat.error?.message;

  return (
    <div className="mt-2 flex flex-col items-end text-right text-sm">
      {left !== 0 && (
        <button onClick={toggle} disabled={disabled || repeat.isPending}
          className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold disabled:opacity-50",
            rec.isRecording ? "border-ink bg-ink text-white" : "border-hairline-strong bg-white")}>
          {rec.isRecording
            ? <><Square size={14} aria-hidden /> Stop and check ({rec.seconds}s)</>
            : repeat.isPending ? "Checking…"
            : <><Mic size={16} aria-hidden /> {view ? "Try again" : "Say it again"}</>}
        </button>
      )}
      <div role="status" className="mt-1 space-y-0.5">
        {view && <p className="text-charcoal">{view.text}</p>}
        {left !== null && <p className="text-muted">{triesText(left)}</p>}
        {problem && <p className="text-charcoal">{problem}</p>}
      </div>
    </div>
  );
}
