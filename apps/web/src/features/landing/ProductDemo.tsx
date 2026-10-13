"use client";
import { useEffect, useReducer, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Check, Globe, Lightbulb, Mic, Smartphone, TrendingUp, FileText, type LucideIcon } from "lucide-react";
import VoiceState from "@/features/ai-chat/components/VoiceState";
import { cn } from "@/lib/utils";
import {
  ANSWERS, CALLOUTS, INITIAL_CHAT, QUESTION, REPORTS, STARTERS, TABS, VOICE_LABEL, chatReducer, feedbackFor, nextVoiceState,
  type Callout, type ChatAction, type ChatState, type DemoTab, type ReportSession, type VoiceState as VoiceStep,
} from "./demo";

const TAB_ICON: Record<DemoTab, LucideIcon> = { web: Globe, phone: Smartphone, voice: Mic, report: FileText };

/** The ring that shows which part of the preview a caption talks about. */
const ring = (on: boolean) => cn("transition-shadow", on && "rounded-2xl ring-2 ring-ink ring-offset-2");

/**
 * "See how it works" (welcome page): tabs, an interactive preview with example data (no API call, no credit) and captions
 * on both sides that light up the part of the preview they explain. Below 1024 px the captions go under the preview.
 */
export default function ProductDemo() {
  const [tab, setTab] = useState<DemoTab>("web");
  const [active, setActive] = useState<string>(CALLOUTS.web[0].id);
  const [chat, dispatch] = useReducer(chatReducer, INITIAL_CHAT);
  const callouts = CALLOUTS[tab];
  const current = callouts.find((c) => c.id === active) ?? callouts[0];
  const hl = current.region;
  const meta = TABS.find((t) => t.id === tab)!;

  const choose = (id: DemoTab) => { setTab(id); setActive(CALLOUTS[id][0].id); };
  const left = callouts.filter((c) => c.side === "left");
  const right = callouts.filter((c) => c.side === "right");

  return (
    <section aria-labelledby="demo-title" className="mt-16">
      <h2 id="demo-title" className="text-2xl font-semibold">See how it works</h2>
      <p className="mt-1 text-muted">Click around: this is a live preview with example data. It spends nothing.</p>

      <div role="tablist" aria-label="Product preview" className="mt-5 flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const Icon = TAB_ICON[t.id];
          return (
            <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="demo-panel" onClick={() => choose(t.id)}
              className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold",
                tab === t.id ? "bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]" : "text-steel")}>
              <Icon size={16} aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      <div id="demo-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <p className="mt-5 max-w-2xl"><span className="font-semibold">{meta.title}.</span> <span className="text-charcoal">{meta.text}</span></p>

        <div className="mt-6 grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)_minmax(0,1fr)]">
          <Captions items={left} side="left" active={current.id} onActive={setActive} className="hidden lg:flex" />
          <div className="min-w-0">
            {tab === "web" && <BrowserFrame><MiniChat state={chat} dispatch={dispatch} hl={hl} answerRegion="answer" /></BrowserFrame>}
            {tab === "phone" && (
              <PhoneFrame on={hl === "screen"}>
                <MiniChat state={chat} dispatch={dispatch} hl={hl} answerRegion="thumb" compact />
              </PhoneFrame>
            )}
            {tab === "voice" && <VoicePreview hl={hl} />}
            {tab === "report" && <ReportPreview hl={hl} />}
          </div>
          <Captions items={right} side="right" active={current.id} onActive={setActive} className="hidden lg:flex" />
        </div>

        <Captions items={callouts} side="all" active={current.id} onActive={setActive} className="mt-6 lg:hidden" />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/ai-chat?scenarioId=visa-us" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-white hover:bg-black/80">
          Try it for real <ArrowRight size={18} />
        </Link>
        <p className="text-sm text-muted">No account needed · 40 free answers</p>
      </div>
    </section>
  );
}

/* ---------- captions ---------- */

function Captions({ items, side, active, onActive, className }: {
  items: Callout[]; side: "left" | "right" | "all"; active: string; onActive: (id: string) => void; className?: string;
}) {
  return (
    <ul className={cn("flex-col gap-2 lg:gap-3", side === "all" ? "grid gap-2 sm:grid-cols-2" : "", className)} aria-label="What you are looking at">
      {items.map((c) => {
        const on = c.id === active;
        return (
          <li key={c.id}>
            <button onClick={() => onActive(c.id)} onMouseEnter={() => onActive(c.id)} onFocus={() => onActive(c.id)} aria-pressed={on}
              className={cn("relative w-full rounded-2xl p-3 text-left text-sm",
                side === "left" && "lg:text-right", on ? "bg-surface" : "hover:bg-surface/60")}>
              <span className="block font-semibold text-ink">{c.label}</span>
              <span className={cn("mt-0.5 block text-charcoal", !on && "lg:hidden")}>{c.detail}</span>
              {/* the line to the preview, on wide screens */}
              {side !== "all" && (
                <span aria-hidden className={cn("absolute top-5 hidden h-px w-4 bg-hairline-strong lg:block", side === "left" ? "-right-5" : "-left-5", on && "bg-ink")} />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- frames ---------- */

function BrowserFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-hairline bg-white shadow-pop">
      <div className="flex items-center gap-2 border-b border-hairline-soft bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />)}</span>
        <span className="mx-auto truncate rounded-full bg-white px-3 py-1 text-xs text-slate">tkallem.vercel.app/ai-chat</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function PhoneFrame({ children, on }: { children: ReactNode; on: boolean }) {
  return (
    <div className={cn("mx-auto w-full max-w-[320px] rounded-[40px] border-[10px] border-ink bg-white p-3 shadow-pop", on && "ring-2 ring-ink ring-offset-4")}>
      <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-hairline-strong" aria-hidden />
      {children}
    </div>
  );
}

/* ---------- web and phone: the mini chat ---------- */

function MiniChat({ state, dispatch, hl, answerRegion, compact }: {
  state: ChatState; dispatch: (a: ChatAction) => void; hl: string; answerRegion: string; compact?: boolean;
}) {
  const fb = feedbackFor(state);
  const interview = state.mode === "interview";
  const picked = state.picked !== null ? ANSWERS[state.picked] : null;
  return (
    <div className="space-y-3 text-left text-sm">
      <div className={cn("inline-flex rounded-full bg-black/[0.04] p-0.5", ring(hl === "mode"))} role="radiogroup" aria-label="Mode">
        {(["practice", "interview"] as const).map((m) => (
          <button key={m} role="radio" aria-checked={state.mode === m} onClick={() => dispatch({ type: "mode", mode: m })}
            className={cn("inline-flex min-h-11 items-center rounded-full px-3 font-semibold", state.mode === m ? "bg-ink text-white" : "text-steel")}>
            {m === "practice" ? "Practice" : "Real interview"}
          </button>
        ))}
      </div>

      <p className={cn("max-w-[85%] rounded-[20px] bg-surface px-4 py-3 text-base", ring(hl === "question"))}>{QUESTION}</p>

      {picked && <p className="ml-auto max-w-[85%] rounded-[20px] bg-ink px-4 py-3 text-base text-white">{picked.text}</p>}

      {/* the feedback: practice shows it, a real interview keeps it for the report */}
      <div className={cn("ml-auto max-w-[95%]", ring(hl === "feedback"))}>
        {fb.kind === "shown" && <Feedback answer={fb.answer} open={state.foldedOpen} onFold={() => dispatch({ type: "fold" })} />}
        {fb.kind === "hidden" && <p className="rounded-2xl border border-dashed border-hairline-strong p-3 text-charcoal">Real interview: nothing is shown now. Everything comes in your report.</p>}
        {fb.kind === "none" && <p className="rounded-2xl border border-dashed border-hairline-strong p-3 text-steel">{interview ? "No corrections until the end." : "Your feedback appears here after each answer."}</p>}
      </div>

      <div className={cn("ml-auto flex max-w-[95%] justify-end", ring(hl === "again"))}>
        {state.step === "nailed" ? (
          <span className="inline-flex min-h-11 items-center rounded-full bg-good-bg px-4 font-semibold text-good"><Check size={16} className="mr-1.5" aria-hidden /> Nailed it</span>
        ) : fb.kind === "shown" ? (
          <button onClick={() => dispatch({ type: "nail" })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-white px-4 font-semibold">
            <Mic size={16} aria-hidden /> Say it again
          </button>
        ) : (
          <span className="inline-flex min-h-11 items-center px-2 text-steel">{interview ? "Say it again opens with the report." : "Say it again appears under a correction."}</span>
        )}
      </div>

      {state.step === "helped" && picked === null && (
        <div className="rounded-2xl border border-hairline bg-surface p-3">
          <p className="font-semibold">You can start with:</p>
          {STARTERS.map((s) => <p key={s} className="mt-1.5 rounded-xl bg-white px-3 py-2 text-base">{s}</p>)}
        </div>
      )}

      <div className={cn("space-y-2 border-t border-hairline-soft pt-3", ring(hl === answerRegion))}>
        {picked === null ? (
          <>
            <p className="text-slate">Try an answer:</p>
            <div className={cn("flex gap-2", compact ? "flex-col" : "flex-col sm:flex-row")}>
              {ANSWERS.map((a, i) => (
                <button key={a.text} onClick={() => dispatch({ type: "pick", index: i })}
                  className="min-h-11 flex-1 rounded-2xl border border-hairline-strong bg-white px-3 py-2 text-left hover:bg-surface">{a.text}</button>
              ))}
            </div>
          </>
        ) : (
          <button onClick={() => dispatch({ type: "reset" })} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">Try another answer</button>
        )}
        <div className={cn("flex items-center", ring(hl === "help"))}>
          <button onClick={() => dispatch({ type: "help" })} disabled={interview || picked !== null}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong px-4 font-semibold disabled:opacity-40">
            <Lightbulb size={16} aria-hidden /> Help me start
          </button>
          {interview && <span className="ml-3 text-steel">Not in a real interview.</span>}
        </div>
      </div>
    </div>
  );
}

function Feedback({ answer, open, onFold }: { answer: (typeof ANSWERS)[number]; open: boolean; onFold: () => void }) {
  return (
    <div className="tk-in rounded-2xl border border-hairline-soft bg-surface p-3">
      <p className="flex items-start gap-1.5 font-medium text-good"><Check size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>{answer.praise}</span></p>
      <p className="mt-2"><s className="text-steel">{answer.fix.original}</s> → <span className="font-semibold text-good">{answer.fix.fixed}</span></p>
      <p className="text-xs text-muted">{answer.fix.why}</p>
      {answer.more.length > 0 && (
        <>
          <button onClick={onFold} aria-expanded={open} className="mt-1 inline-flex min-h-11 items-center font-semibold">
            {answer.more.length} more small fix{answer.more.length > 1 ? "es" : ""}
          </button>
          {open && answer.more.map((f) => (
            <div key={f.original}><p><s className="text-steel">{f.original}</s> → <span className="font-semibold text-good">{f.fixed}</span></p><p className="text-xs text-muted">{f.why}</p></div>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- voice ---------- */

function VoicePreview({ hl }: { hl: string }) {
  const [state, setState] = useState<VoiceStep>("idle");
  // listening waits for the tap that sends it; thinking and speaking move on by themselves
  useEffect(() => {
    if (state === "thinking" || state === "speaking") {
      const t = setTimeout(() => setState(nextVoiceState(state)), state === "thinking" ? 1300 : 2400);
      return () => clearTimeout(t);
    }
  }, [state]);
  const heard = state === "thinking" || state === "speaking";
  return (
    <div className="rounded-[28px] border border-hairline bg-white p-5 shadow-pop">
      <p className="max-w-[85%] rounded-[20px] bg-surface px-4 py-3 text-base">{QUESTION}</p>
      <div className={cn("mt-3 min-h-16", ring(hl === "transcript"))}>
        {heard ? (
          <p className="tk-in ml-auto max-w-[85%] rounded-[20px] bg-ink px-4 py-3 text-base text-white">I go to the US to study.</p>
        ) : (
          <p className="rounded-2xl border border-dashed border-hairline-strong p-3 text-sm text-steel">Your words appear here, written, after you speak.</p>
        )}
      </div>
      {state === "speaking" && <p className="tk-in mt-3 max-w-[85%] rounded-[20px] bg-surface px-4 py-3 text-base">You want to study. Which university will you attend?</p>}
      <div className={cn("mt-4 flex min-h-11 items-center", ring(hl === "state"))}>
        <VoiceState state={state} seconds={0} />
        {state === "idle" && <span className="text-sm text-steel">Tap the microphone, then say your answer.</span>}
      </div>
      <div className="mt-4 flex flex-col items-center">
        <div className={cn("rounded-full p-1.5", ring(hl === "mic"), state === "listening" && "bg-brand-yellow")}>
          <button onClick={() => setState((s) => (s === "idle" || s === "listening" ? nextVoiceState(s) : s))} disabled={heard}
            aria-label={state === "listening" ? "Stop and send" : "Answer by voice"}
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-ink text-white disabled:opacity-60">
            <Mic size={28} aria-hidden />
          </button>
        </div>
        <span className="mt-2 text-sm text-slate">{state === "listening" ? "Tap to send" : VOICE_LABEL.idle}</span>
      </div>
    </div>
  );
}

/* ---------- report ---------- */

function ReportPreview({ hl }: { hl: string }) {
  const [n, setN] = useState<ReportSession>(1);
  const r = REPORTS[n];
  return (
    <div className="rounded-[28px] border border-hairline bg-white p-5 shadow-pop">
      <div role="radiogroup" aria-label="Which session" className="inline-flex rounded-full bg-black/[0.04] p-0.5">
        {([1, 3] as const).map((s) => (
          <button key={s} role="radio" aria-checked={n === s} onClick={() => setN(s)}
            className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold", n === s ? "bg-ink text-white" : "text-steel")}>
            Session {s}
          </button>
        ))}
      </div>
      <p className={cn("mt-4 flex items-start gap-2 rounded-2xl bg-good-bg px-4 py-3 text-sm font-medium text-good", ring(hl === "progress"))}>
        <TrendingUp size={18} className="mt-0.5 shrink-0" aria-hidden /> <span>{r.progress}</span>
      </p>
      <div className={cn("mt-3 rounded-2xl border border-hairline p-4", ring(hl === "freeze"))}>
        <p className="text-sm text-muted">Time before you speak</p>
        <p className="mt-1 text-3xl font-medium">{r.freeze} <span className="text-base font-normal text-slate">average</span></p>
        <p className="mt-1 text-sm text-charcoal">{r.freezeNote}</p>
      </div>
      <p className={cn("mt-3 rounded-2xl bg-good-bg px-4 py-3 text-sm font-medium text-good", ring(hl === "confidence"))}>{r.confidence}</p>
      <div className={cn("mt-3 rounded-2xl border border-hairline p-4 text-sm", ring(hl === "redo"))}>
        <p className="font-semibold">{r.mistakes}</p>
        <p className="mt-1 text-charcoal">{r.redo}</p>
      </div>
    </div>
  );
}
