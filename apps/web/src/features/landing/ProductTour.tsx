"use client";
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Globe, Lightbulb, Mic } from "lucide-react";
import { scenarioTint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import {
  FOCUS_CHOICES, GOALS, INTEREST_CHOICES, LEVEL_CHOICES, MAX_FOCUS, MINUTE_CHOICES,
} from "@/features/plan/lib/plan";
import TourCallouts from "./TourCallouts";
import Platform from "./PlatformPages";
import { MessageCircle } from "lucide-react";
import { VoiceCoachView, VoiceCallButton } from "@/features/ai-chat/components/VoiceCoachView";
import CorrectionCard from "@/features/ai-chat/components/CorrectionCard";
import Choice from "@/features/plan/PlanChoice";
import { Browser, Lit, Pill, R } from "./TourParts";
import {
  INITIAL_PLAN, PAGE_ORDER, PLAN_STEPS, TABS, visibleCallouts, planReducer, planView,
  type Callout, type PlanAction, type PlanDemo, type PlatformPage, type TourTab,
} from "./tour";

const LIT_MS = 3200;

/**
 * "Look inside the app" (welcome page): a preview of the app with captions on both sides. Point at a caption (or tap it)
 * and the part of the preview it talks about lights up; a thin line links them on wide screens. The tour plays by itself
 * until the visitor touches it. Example data only: no API call, no credit.
 */
export default function ProductTour() {
  const [tab, setTab] = useState<TourTab>("platform");
  const [page, setPage] = useState<PlatformPage>("home");
  const [active, setActive] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [visible, setVisible] = useState(false);
  const [calm, setCalm] = useState(false);
  const [plan, dispatch] = useReducer(planReducer, INITIAL_PLAN);
  const stage = useRef<HTMLDivElement>(null);
  const callouts = visibleCallouts(tab, page, plan.step >= PLAN_STEPS);

  const act = useCallback((a: PlanAction) => { setAuto(false); dispatch(a); }, []);
  const show = (region: string | null) => {
    // The plan preview shows the part a caption talks about: the result, or the questions.
    if (tab === "plan" && region) {
      if (["result", "order"].includes(region)) dispatch({ type: "finish" });
      else if (plan.step >= PLAN_STEPS) dispatch({ type: "reset" });
    }
    setActive(region);
  };

  useEffect(() => { setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches); }, []);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The tour: one caption after the other; the platform tab then moves to the next page of the menu, until the visitor takes over.
  const turn = useRef(0);
  const now = useRef({ tab, page, done: false });
  now.current = { tab, page, done: plan.step >= PLAN_STEPS };
  useEffect(() => { turn.current = 0; setActive(null); }, [tab, page]);
  useEffect(() => {
    if (!auto || calm || !visible) return;
    const tick = () => {
      const { tab: t, page: p, done } = now.current;
      const list = visibleCallouts(t, p, done);
      if (turn.current >= list.length) {
        const next = PAGE_ORDER[PAGE_ORDER.indexOf(p) + 1];
        if (t === "platform" && next) setPage(next); // the effect above resets the turn
        else { setAuto(false); setActive(null); }
        return;
      }
      const c = list[turn.current];
      turn.current += 1;
      show(c.region);
    };
    tick();
    const t = setInterval(tick, LIT_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, calm, visible, tab]);

  const meta = TABS.find((t) => t.id === tab)!;
  const choose = (t: TourTab) => { setTab(t); setPage("home"); setActive(null); setAuto(false); };

  return (
    <section id="tour" aria-labelledby="tour-title" className="scroll-mt-8">
      <div className="text-center">
        <h2 id="tour-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Look inside the app</h2>
        <p className="mx-auto mt-2 max-w-xl text-lg text-charcoal">Point at a label, or tap it: the part of the app it talks about lights up.</p>
      </div>

      <div className="mt-6 flex justify-center">
        <div role="tablist" aria-label="Product preview" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-black/[0.04] p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button key={t.id} role="tab" id={`tour-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="tour-panel" onClick={() => choose(t.id)}
              className={cn("min-h-12 shrink-0 rounded-full px-5 text-sm font-semibold sm:text-base", tab === t.id ? "bg-ink text-white border border-ink" : "text-steel hover:text-ink")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-xl text-center text-charcoal"><span className="font-semibold">{meta.title}.</span> {meta.text}</p>

      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${tab}`}>
        <Lit.Provider value={active}>
          <TourCallouts callouts={callouts} active={active} onShow={show} onEngage={() => setAuto(false)} stageRef={stage}>
            {tab === "platform" && <Platform plan={plan} page={page} onPage={(p) => { setAuto(false); setPage(p); }} />}
            {tab === "plan" && <PlanPreview plan={plan} act={act} />}
            {tab === "voice" && <VoicePreview />}
          </TourCallouts>
        </Lit.Provider>
      </div>

      <p className="mt-5 text-center text-sm text-slate">Example data. It spends nothing and records nothing.</p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/plan" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 py-3 text-base font-semibold text-white hover:bg-black/80">
          Build my speaking plan <ArrowRight size={18} aria-hidden />
        </Link>
        <p className="text-sm text-slate">No account needed · 40 free answers</p>
      </div>
    </section>
  );
}

/* ---------- tab 2: the plan, answered for real ---------- */

function PlanPreview({ plan, act }: { plan: PlanDemo; act: (a: PlanAction) => void }) {
  const v = planView(plan);
  const done = plan.step >= PLAN_STEPS;
  return (
    <Browser url="tkallem.vercel.app/plan">
      <div className="flex min-h-[540px] flex-col gap-2 p-5 text-sm md:p-8">
        {done ? (
          <>
            <R id="result" className="mb-5">
              <h3 className="text-2xl font-bold tracking-tight">Your plan</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-slate">Goal</dt><dd className="font-semibold">{GOALS.find((g) => g.id === v.goal)?.label}</dd>
                <dt className="text-slate">Level</dt><dd className="font-semibold">{v.level}</dd>
                <dt className="text-slate">Daily goal</dt><dd className="font-semibold">{v.minutes} minutes</dd>
                <dt className="text-slate">Working on</dt><dd className="font-semibold">{FOCUS_CHOICES.filter((f) => v.focus.includes(f.id)).map((f) => f.label).join(", ")}</dd>
              </dl>
            </R>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Practice in this order</p>
            <R id="order" className="grid grid-cols-2 gap-2">
              {v.path.slice(0, 4).map((s, i) => (
                <div key={s.id} className={cn("flex min-h-[72px] items-center gap-2 rounded-[18px] p-3", scenarioTint(s.category), s.category === "speaking" && "border border-hairline-soft")}>
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-semibold">{i + 1}</span>
                  <span className="min-w-0 text-[13px] font-semibold">{s.title}<small className="block text-xs font-normal">{s.minutes} min · {s.level}</small></span>
                </div>
              ))}
            </R>
            <p className="mt-3 text-xs text-slate">Saved. You can change it any time in your profile.</p>
            <button type="button" onClick={() => act({ type: "reset" })} className="mt-3 min-h-11 self-start rounded-full bg-ink px-5 text-sm font-semibold text-white">Start over</button>
          </>
        ) : (
          <>
            <R id="progress" className="mb-5">
              <div className="mb-1.5 flex justify-between text-xs text-slate">
                {plan.step > 0 ? <button type="button" onClick={() => act({ type: "back" })} className="inline-flex min-h-8 items-center gap-1 font-medium"><ArrowLeft size={14} aria-hidden /> Back</button> : <span />}
                <span>Question {plan.step + 1} of {PLAN_STEPS}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-hairline"><div className="h-full origin-left rounded-full bg-ink transition-transform duration-300 ease-out" style={{ transform: `scaleX(${(plan.step + 1) / PLAN_STEPS})` }} /></div>
            </R>
            <R id="question" className="mb-5">
              <h3 className="text-2xl font-bold leading-tight tracking-tight">{["Why do you need English?", "How is your English when you speak?", "How much time can you practice each day?", "What is hardest for you?", "Which subjects do you like?"][plan.step]}</h3>
              <p className="mt-1 text-[13px] text-slate">{["We start with the situations that match your goal.", "No test. It sets how the coach talks to you.", "This becomes your daily goal.", `Pick up to ${MAX_FOCUS}. The coach keeps them in mind.`, "Optional. They decide which situations come next."][plan.step]}</p>
            </R>
            <R id="choices" className="space-y-3">
              {plan.step === 0 && GOALS.map((g, index) => <Choice compact tone={["bg-rose", "bg-mint", "bg-peach", "bg-lilac", "bg-butter"][index % 5]} key={g.id} title={g.label} selected={plan.goal === g.id} onClick={() => act({ type: "goal", value: g.id })} />)}
              {plan.step === 1 && LEVEL_CHOICES.map((l, index) => <Choice compact tone={["bg-rose", "bg-mint", "bg-peach", "bg-lilac", "bg-butter"][index % 5]} key={l.level} title={l.title} text={l.text} selected={plan.level === l.level} onClick={() => act({ type: "level", value: l.level })} />)}
              {plan.step === 2 && MINUTE_CHOICES.map((m, index) => <Choice compact tone={["bg-rose", "bg-mint", "bg-peach", "bg-lilac", "bg-butter"][index % 5]} key={m} title={`${m} minutes`} selected={plan.minutes === m} onClick={() => act({ type: "minutes", value: m })} />)}
              {plan.step === 3 && FOCUS_CHOICES.map((f, index) => <Choice compact tone={["bg-rose", "bg-mint", "bg-peach", "bg-lilac", "bg-butter"][index % 5]} key={f.id} title={f.label} text={f.text} multi selected={plan.focus.includes(f.id)} disabled={!plan.focus.includes(f.id) && plan.focus.length >= MAX_FOCUS} onClick={() => act({ type: "focus", value: f.id })} />)}
              {plan.step === 4 && <div className="grid grid-cols-2 gap-x-2">{INTEREST_CHOICES.map((i, index) => <Choice compact tone={["bg-rose", "bg-mint", "bg-peach", "bg-lilac", "bg-butter"][index % 5]} key={i.id} title={i.label} multi selected={plan.interests.includes(i.id)} onClick={() => act({ type: "interest", value: i.id })} />)}</div>}
              {plan.step >= 3 && (
                <button type="button" onClick={() => act({ type: plan.step === 4 ? "finish" : "next" })} disabled={plan.step === 3 && plan.focus.length === 0}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-40">
                  {plan.step === 4 ? "See my plan" : "Next"} <ArrowRight size={14} aria-hidden />
                </button>
              )}
            </R>
            <R id="skip" className="mt-auto pt-3 text-center text-xs text-slate underline">Skip, start a visa interview now</R>
          </>
        )}
      </div>
    </Browser>
  );
}

/* ---------- tab 3: the voice ---------- */
function VoicePreview() {
  const [speaking, setSpeaking] = useState(false);
  return <Browser url="tkallem.vercel.app/ai-chat">
    <div className="p-5 sm:p-8">
      <div className="mb-6 flex justify-between"><Pill>Free talk · Voice</Pill><Pill>Level B1</Pill></div>
      <VoiceCoachView avatar={<span className="flex h-40 w-40 items-center justify-center rounded-3xl bg-mint/50"><MessageCircle size={64} className="text-ink/50" /></span>}
        status={<R id="state" as="span">{speaking ? "Demo call — listening" : "Start a call, then speak naturally."}</R>}>
        <R id="mic" className="mt-6 flex w-full justify-center"><VoiceCallButton active={speaking} onClick={() => setSpeaking((value) => !value)} /></R>
        <R id="backup" className="mt-3 text-xs text-muted">Demo only. Your microphone is never accessed.</R>
      </VoiceCoachView>
      <R id="transcript" className="mt-8"><h3 className="mb-3 font-semibold">Live corrections</h3><CorrectionCard c={{ original: "I goed home", fixed: "I went home", type: "grammar", why: "Go has the irregular past tense went." }} /></R>
    </div>
  </Browser>;
}
