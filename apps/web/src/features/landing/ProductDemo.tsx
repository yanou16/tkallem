"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Globe, Lightbulb, Mic, Pause, Play, Plane, Smartphone, TrendingUp, FileText, type LucideIcon } from "lucide-react";
import VoiceState from "@/features/ai-chat/components/VoiceState";
import { cn } from "@/lib/utils";
import {
  ANSWERS, CALLOUTS, QUESTION, REPORTS, STARTERS, TABS, VOICE_LABEL, chatReducer, feedbackFor, nextVoiceState, numbers, stepView,
  type Callout, type ChatAction, type ChatState, type DemoTab, type ReportSession, type VoiceState as VoiceStep,
} from "./demo";

const TAB_ICON: Record<DemoTab, LucideIcon> = { web: Globe, phone: Smartphone, voice: Mic, report: FileText };
const TOUR_MS = 4500;

type Nums = Record<string, number>;

/**
 * "See how it works" (welcome page): a guided tour. Four tabs; in each, numbered steps (captions on both sides, under the
 * preview on small screens) and a preview that shows the step in action, with the same number on the part it explains.
 * Next / Back / Play move through the steps; every part of the preview can also be clicked. Example data only: no API
 * call, no credit.
 */
export default function ProductDemo() {
  const [tab, setTab] = useState<DemoTab>("web");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [chat, setChat] = useState<ChatState>(stepView("web", 0).chat);
  const [voice, setVoice] = useState<VoiceStep>("idle");
  const [session, setSession] = useState<ReportSession>(3);
  const [calm, setCalm] = useState(false); // prefers-reduced-motion: no automatic tour

  const callouts = CALLOUTS[tab];
  const nums = numbers(tab);
  const current = callouts[step];
  const hl = current.region;
  const meta = TABS.find((t) => t.id === tab)!;
  const last = callouts.length - 1;

  const go = (t: DemoTab, i: number) => {
    const v = stepView(t, i);
    setStep(i); setChat(v.chat); setVoice(v.voice); setSession(v.report);
  };
  const choose = (t: DemoTab) => { setTab(t); setPlaying(false); go(t, 0); };
  const touch = () => setPlaying(false); // the visitor took over
  const dispatch = (a: ChatAction) => { touch(); setChat((s) => chatReducer(s, a)); };

  useEffect(() => { setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => (step < last ? go(tab, step + 1) : setPlaying(false)), TOUR_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, step, tab]);

  const left = callouts.map((c, i) => ({ c, i })).filter(({ c }) => c.side === "left");
  const right = callouts.map((c, i) => ({ c, i })).filter(({ c }) => c.side === "right");

  return (
    <section aria-labelledby="demo-title" className="mt-16 xl:-mx-16">
      <h2 id="demo-title" className="text-2xl font-semibold sm:text-3xl">See how it works</h2>
      <p className="mt-1 max-w-2xl text-muted">A 30-second tour of an interview. Press play, or click anything: it is a live preview with example data and spends nothing.</p>

      <div role="tablist" aria-label="Product preview" className="mt-5 flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const Icon = TAB_ICON[t.id];
          return (
            <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls="demo-panel" onClick={() => choose(t.id)}
              className={cn("inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-semibold sm:text-base",
                tab === t.id ? "bg-ink text-white" : "text-steel hover:text-ink")}>
              <Icon size={18} aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      <div id="demo-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <p className="max-w-2xl"><span className="text-xl font-semibold">{meta.title}.</span> <span className="text-charcoal">{meta.text}</span></p>
          <Tour step={step} total={callouts.length} playing={playing} calm={calm}
            onBack={() => { touch(); go(tab, Math.max(0, step - 1)); }}
            onNext={() => { touch(); go(tab, Math.min(last, step + 1)); }}
            onPlay={() => { if (playing) return setPlaying(false); go(tab, step >= last ? 0 : step); setPlaying(true); }} />
        </div>

        <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,540px)_minmax(0,1fr)]">
          <Steps items={left} active={step} onPick={(i) => { touch(); go(tab, i); }} className="hidden lg:flex" />
          <Stage>
            {tab === "web" && <BrowserFrame><MiniChat state={chat} dispatch={dispatch} hl={hl} nums={nums} answerRegion="answer" /></BrowserFrame>}
            {tab === "phone" && (
              <PhoneFrame hl={hl} nums={nums}>
                <MiniChat state={chat} dispatch={dispatch} hl={hl} nums={nums} answerRegion="thumb" compact />
              </PhoneFrame>
            )}
            {tab === "voice" && <VoicePreview state={voice} onTap={() => { touch(); setVoice((s) => nextVoiceState(s)); }} hl={hl} nums={nums} />}
            {tab === "report" && <ReportPreview session={session} onSession={(n) => { touch(); setSession(n); }} hl={hl} nums={nums} />}
          </Stage>
          <Steps items={right} active={step} onPick={(i) => { touch(); go(tab, i); }} className="hidden lg:flex" />
        </div>

        <Steps items={callouts.map((c, i) => ({ c, i }))} active={step} onPick={(i) => { touch(); go(tab, i); }} className="mt-6 lg:hidden" all />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/ai-chat?scenarioId=visa-us" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-base font-semibold text-white hover:bg-black/80">
          Try it for real <ArrowRight size={18} />
        </Link>
        <p className="text-sm text-muted">No account needed · 40 free answers</p>
      </div>
    </section>
  );
}

/* ---------- tour controls ---------- */

function Tour({ step, total, playing, calm, onBack, onNext, onPlay }: {
  step: number; total: number; playing: boolean; calm: boolean; onBack: () => void; onNext: () => void; onPlay: () => void;
}) {
  const round = "inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline-strong bg-white disabled:opacity-40";
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Tour controls">
      <button onClick={onBack} disabled={step === 0} aria-label="Previous step" className={round}><ArrowLeft size={18} aria-hidden /></button>
      <span className="min-w-[4.5rem] text-center text-sm font-semibold" aria-live="polite">Step {step + 1} of {total}</span>
      <button onClick={onNext} disabled={step === total - 1} aria-label="Next step" className={round}><ArrowRight size={18} aria-hidden /></button>
      {!calm && (
        <button onClick={onPlay} className="ml-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">
          {playing ? <><Pause size={16} aria-hidden /> Pause</> : <><Play size={16} aria-hidden /> Play the tour</>}
        </button>
      )}
    </div>
  );
}

/* ---------- numbered steps ---------- */

function Num({ n, on, className }: { n: number; on: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
      on ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-ink", className)}>{n}</span>
  );
}

function Steps({ items, active, onPick, className, all }: {
  items: { c: Callout; i: number }[]; active: number; onPick: (i: number) => void; className?: string; all?: boolean;
}) {
  return (
    <ol className={cn("flex-col gap-2", all && "grid gap-2 sm:grid-cols-2", className)} aria-label="Steps">
      {items.map(({ c, i }) => {
        const on = i === active;
        return (
          <li key={c.id}>
            <button onClick={() => onPick(i)} aria-current={on ? "step" : undefined}
              className={cn("flex w-full items-start gap-3 rounded-2xl border p-3 text-left", on ? "border-ink bg-white shadow-pop" : "border-transparent hover:bg-surface")}>
              <Num n={i + 1} on={on} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block text-base font-semibold text-ink">{c.label}</span>
                <span className={cn("mt-1 block text-sm leading-relaxed text-charcoal", !on && !all && "hidden")}>{c.detail}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- the stage: a coloured backdrop, the example, and the numbered parts ---------- */

function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[28px] bg-tint-visa p-3 sm:p-6">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-charcoal"><Plane size={14} aria-hidden /> Example: a US visa interview</p>
      {children}
    </div>
  );
}

/** A part of the preview a step points at: ringed when its caption is the current one, with the same number. */
function Region({ name, hl, nums, className, children }: { name: string; hl: string; nums: Nums; className?: string; children: ReactNode }) {
  const n = nums[name];
  const on = hl === name;
  return (
    <div className={cn("relative transition-shadow", on && "rounded-2xl ring-2 ring-ink ring-offset-2", className)}>
      {n !== undefined && <Num n={n} on={on} className="absolute -left-2.5 -top-2.5 z-10" />}
      {children}
    </div>
  );
}

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

function PhoneFrame({ children, hl, nums }: { children: ReactNode; hl: string; nums: Nums }) {
  return (
    <Region name="screen" hl={hl} nums={nums} className="mx-auto w-full max-w-[320px] !rounded-[44px]">
      <div className="rounded-[40px] border-[10px] border-ink bg-white p-3 shadow-pop">
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-hairline-strong" aria-hidden />
        {children}
      </div>
    </Region>
  );
}

/* ---------- web and phone: the mini chat ---------- */

function MiniChat({ state, dispatch, hl, nums, answerRegion, compact }: {
  state: ChatState; dispatch: (a: ChatAction) => void; hl: string; nums: Nums; answerRegion: string; compact?: boolean;
}) {
  const fb = feedbackFor(state);
  const interview = state.mode === "interview";
  const picked = state.picked !== null ? ANSWERS[state.picked] : null;
  return (
    <div className="space-y-3 text-left text-sm">
      <Region name="mode" hl={hl} nums={nums} className="inline-block">
        <div className="inline-flex rounded-full bg-black/[0.05] p-0.5" role="radiogroup" aria-label="Mode">
          {(["practice", "interview"] as const).map((m) => (
            <button key={m} role="radio" aria-checked={state.mode === m} onClick={() => dispatch({ type: "mode", mode: m })}
              className={cn("inline-flex min-h-11 items-center rounded-full px-4 font-semibold", state.mode === m ? "bg-ink text-white" : "text-steel")}>
              {m === "practice" ? "Practice" : "Real interview"}
            </button>
          ))}
        </div>
      </Region>

      <Region name="question" hl={hl} nums={nums} className="flex items-start gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint-visa" aria-hidden><Plane size={18} /></span>
        <p className="rounded-[20px] bg-surface px-4 py-3 text-base">{QUESTION}</p>
      </Region>

      {/* your turn: help, then the answer (read top to bottom in the order of the numbers) */}
      <Region name="help" hl={hl} nums={nums} className="space-y-2">
        <div>
          <button onClick={() => dispatch({ type: "help" })} disabled={interview || picked !== null}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-white px-4 font-semibold disabled:opacity-40">
            <Lightbulb size={16} aria-hidden /> Help me start
          </button>
          {interview && <span className="ml-3 text-steel">Not in a real interview.</span>}
        </div>
        {state.step === "helped" && picked === null && (
          <div className="tk-in rounded-2xl bg-tint-campus p-3">
            <p className="font-semibold text-charcoal">You can start with:</p>
            {STARTERS.map((s) => <p key={s} className="mt-1.5 rounded-xl bg-white px-3 py-2 text-base">{s}</p>)}
          </div>
        )}
      </Region>

      <Region name={answerRegion} hl={hl} nums={nums} className="space-y-2">
        {picked === null ? (
          <>
            <p className="font-semibold text-slate">Tap an example answer:</p>
            <div className={cn("flex gap-2", compact ? "flex-col" : "flex-col sm:flex-row")}>
              {ANSWERS.map((a, i) => (
                <button key={a.text} onClick={() => dispatch({ type: "pick", index: i })}
                  className="min-h-11 flex-1 rounded-2xl border-2 border-ink bg-white px-3 py-2 text-left font-medium hover:bg-surface">{a.text}</button>
              ))}
            </div>
          </>
        ) : (
          <p className="tk-in ml-auto max-w-[92%] rounded-[20px] bg-ink px-4 py-3 text-base text-white">{picked.text}</p>
        )}
      </Region>

      <Region name="feedback" hl={hl} nums={nums} className="ml-auto max-w-[96%]">
        {fb.kind === "shown" && <Feedback answer={fb.answer} open={state.foldedOpen} onFold={() => dispatch({ type: "fold" })} />}
        {fb.kind === "hidden" && <p className="rounded-2xl bg-warn-bg p-3 text-charcoal"><span className="font-semibold text-warn">Real interview.</span> Nothing is shown now. Everything comes in your report at the end.</p>}
        {fb.kind === "none" && <p className="rounded-2xl border border-dashed border-hairline-strong p-3 text-steel">{interview ? "No corrections until the end." : "After your answer, its feedback appears here."}</p>}
      </Region>

      <Region name="again" hl={hl} nums={nums} className="ml-auto flex max-w-[96%] justify-end">
        {state.step === "nailed" ? (
          <span className="tk-in inline-flex min-h-11 items-center rounded-full bg-good-bg px-4 font-semibold text-good"><Check size={16} className="mr-1.5" aria-hidden /> Nailed it</span>
        ) : fb.kind === "shown" ? (
          <button onClick={() => dispatch({ type: "nail" })} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline-strong bg-white px-4 font-semibold">
            <Mic size={16} aria-hidden /> Say it again
          </button>
        ) : (
          <span className="inline-flex min-h-11 items-center px-2 text-steel">{interview ? "Say it again opens with the report." : "Say it again appears under a correction."}</span>
        )}
      </Region>

      {picked !== null && (
        <button onClick={() => dispatch({ type: "reset" })} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">Try another answer</button>
      )}
    </div>
  );
}

function Feedback({ answer, open, onFold }: { answer: (typeof ANSWERS)[number]; open: boolean; onFold: () => void }) {
  return (
    <div className="tk-in space-y-2 rounded-2xl border border-hairline-soft bg-white p-2">
      <p className="flex items-start gap-1.5 rounded-xl bg-good-bg px-3 py-2 font-medium text-good"><Check size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>{answer.praise}</span></p>
      <div className="rounded-xl bg-warn-bg px-3 py-2">
        <p><s className="text-steel">{answer.fix.original}</s> → <span className="font-semibold text-good">{answer.fix.fixed}</span></p>
        <p className="mt-0.5 text-xs text-charcoal">{answer.fix.why}</p>
      </div>
      {answer.more.length > 0 && (
        <>
          <button onClick={onFold} aria-expanded={open} className="inline-flex min-h-11 items-center px-1 font-semibold text-ink">
            {open ? "Hide" : `${answer.more.length} more small fix${answer.more.length > 1 ? "es" : ""}`}
          </button>
          {open && answer.more.map((f) => (
            <div key={f.original} className="rounded-xl bg-warn-bg px-3 py-2"><p><s className="text-steel">{f.original}</s> → <span className="font-semibold text-good">{f.fixed}</span></p><p className="mt-0.5 text-xs text-charcoal">{f.why}</p></div>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- voice ---------- */

function VoicePreview({ state, onTap, hl, nums }: { state: VoiceStep; onTap: () => void; hl: string; nums: Nums }) {
  const heard = state === "thinking" || state === "speaking";
  return (
    <div className="rounded-[24px] border border-hairline bg-white p-5 shadow-pop">
      <div className="flex items-start gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint-visa" aria-hidden><Plane size={18} /></span>
        <p className="rounded-[20px] bg-surface px-4 py-3 text-base">{QUESTION}</p>
      </div>
      <Region name="transcript" hl={hl} nums={nums} className="mt-3 min-h-16">
        {heard ? (
          <p className="tk-in ml-auto max-w-[88%] rounded-[20px] bg-ink px-4 py-3 text-base text-white">I go to the US to study.</p>
        ) : (
          <p className="rounded-2xl border border-dashed border-hairline-strong p-3 text-sm text-steel">Your words appear here, written, after you speak.</p>
        )}
      </Region>
      {state === "speaking" && (
        <p className="tk-in mt-3 flex items-start gap-2"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint-visa" aria-hidden><Plane size={18} /></span>
          <span className="rounded-[20px] bg-surface px-4 py-3 text-base">You want to study. Which university will you attend?</span></p>
      )}
      <Region name="state" hl={hl} nums={nums} className="mt-4 flex min-h-12 items-center rounded-2xl bg-surface px-4">
        <VoiceState state={state} seconds={0} />
        {state === "idle" && <span className="text-sm text-slate">Nothing is playing. Tap the microphone.</span>}
      </Region>
      <Region name="mic" hl={hl} nums={nums} className="mx-auto mt-4 w-fit !rounded-full">
        <div className="flex flex-col items-center p-1">
          <div className={cn("rounded-full p-1.5", state === "listening" && "bg-brand-yellow")}>
            <button onClick={onTap} aria-label={VOICE_LABEL[state]}
              className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-ink text-white">
              <Mic size={28} aria-hidden />
            </button>
          </div>
          <span className="mt-2 text-sm text-slate">{state === "idle" ? "Tap to speak" : "Tap to go on"}</span>
        </div>
      </Region>
    </div>
  );
}

/* ---------- report ---------- */

function ReportPreview({ session, onSession, hl, nums }: { session: ReportSession; onSession: (n: ReportSession) => void; hl: string; nums: Nums }) {
  const r = REPORTS[session];
  return (
    <div className="rounded-[24px] border border-hairline bg-white p-5 shadow-pop">
      <div role="radiogroup" aria-label="Which session" className="inline-flex rounded-full bg-black/[0.05] p-0.5">
        {([1, 3] as const).map((s) => (
          <button key={s} role="radio" aria-checked={session === s} onClick={() => onSession(s)}
            className={cn("inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold", session === s ? "bg-ink text-white" : "text-steel")}>
            Session {s}
          </button>
        ))}
      </div>
      <Region name="progress" hl={hl} nums={nums} className="mt-4">
        <p className="flex items-start gap-2 rounded-2xl bg-good-bg px-4 py-3 text-sm font-medium text-good"><TrendingUp size={18} className="mt-0.5 shrink-0" aria-hidden /> <span>{r.progress}</span></p>
      </Region>
      <Region name="freeze" hl={hl} nums={nums} className="mt-3">
        <div className="rounded-2xl bg-warn-bg p-4">
          <p className="text-sm text-charcoal">Time before you speak</p>
          <p className="mt-1 text-4xl font-medium">{r.freeze} <span className="text-base font-normal text-slate">average</span></p>
          <p className="mt-1 text-sm font-medium text-charcoal">{r.freezeNote}</p>
        </div>
      </Region>
      <Region name="confidence" hl={hl} nums={nums} className="mt-3">
        <p className="rounded-2xl bg-good-bg px-4 py-3 text-sm font-medium text-good">{r.confidence}</p>
      </Region>
      <Region name="redo" hl={hl} nums={nums} className="mt-3">
        <div className="rounded-2xl border border-hairline p-4 text-sm">
          <p className="font-semibold">{r.mistakes}</p>
          <p className="mt-1 text-charcoal">{r.redo}</p>
        </div>
      </Region>
    </div>
  );
}
