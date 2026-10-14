"use client";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Globe, Lightbulb, Lock, Mic, Zap } from "lucide-react";
import { Icon } from "@/lib/icons";
import { scenarioTint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import {
  FOCUS_CHOICES, GOALS, INTEREST_CHOICES, LEVEL_CHOICES, MAX_FOCUS, MINUTE_CHOICES,
} from "@/features/plan/lib/plan";
import {
  CALLOUTS, INITIAL_PLAN, PLAN_STEPS, TABS, planReducer, planView,
  type Callout, type PlanAction, type PlanDemo, type TourTab,
} from "./tour";

const LIT_MS = 3200;
const WIDE = 1024; // lg: captions on both sides with lines; under it, cards below the preview

const Lit = createContext<string | null>(null);

/** A part of the preview a caption can point at: lit when its caption is active, the rest fades. */
function R({ id, className, children, as: Tag = "div" }: { id: string; className?: string; children: ReactNode; as?: "div" | "span" | "p" }) {
  const active = useContext(Lit);
  return (
    <Tag data-region={id}
      className={cn("transition-opacity duration-200", active && active !== id && "opacity-30",
        active === id && "rounded-lg outline outline-2 outline-offset-[3px] outline-ink", className)}>
      {children}
    </Tag>
  );
}

type Line = { id: string; x1: number; y1: number; x2: number; y2: number };

/**
 * "See how it works" (welcome page): a preview of the app with captions on both sides. Point at a caption (or tap it)
 * and the part of the preview it talks about lights up; a thin line links them on wide screens. The tour plays by itself
 * until the visitor touches it. Example data only: no API call, no credit.
 */
export default function ProductTour() {
  const [tab, setTab] = useState<TourTab>("platform");
  const [active, setActive] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [calm, setCalm] = useState(false);
  const [plan, dispatch] = useReducer(planReducer, INITIAL_PLAN);
  const [lines, setLines] = useState<Line[]>([]);
  const stage = useRef<HTMLDivElement>(null);
  const callouts = CALLOUTS[tab];
  const left = callouts.filter((c) => c.side === "left");
  const right = callouts.filter((c) => c.side === "right");

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

  // The tour: one caption after the other, until the visitor takes over.
  const turn = useRef(0);
  useEffect(() => { turn.current = 0; setActive(null); }, [tab]);
  useEffect(() => {
    if (!auto || calm || !visible) return;
    const tick = () => {
      const c = callouts[turn.current % callouts.length];
      turn.current += 1;
      show(c.region);
    };
    tick();
    const t = setInterval(tick, LIT_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, calm, visible, tab]);

  // Lines from each caption to its part, on wide screens.
  const measure = useCallback(() => {
    const st = stage.current;
    if (!st || window.innerWidth < WIDE) return setLines([]);
    const sb = st.getBoundingClientRect();
    const out: Line[] = [];
    st.querySelectorAll<HTMLElement>("[data-callout]").forEach((l) => {
      const target = st.querySelector<HTMLElement>(`[data-region="${l.dataset.callout}"]`);
      if (!target) return;
      const lb = l.getBoundingClientRect();
      const tb = target.getBoundingClientRect();
      const isLeft = l.dataset.side === "left";
      out.push({
        id: `${l.dataset.side}-${l.dataset.callout}`,
        x1: (isLeft ? lb.right + 6 : lb.left - 6) - sb.left, y1: lb.top + 16 - sb.top,
        x2: (isLeft ? tb.left : tb.right) - sb.left, y2: tb.top + Math.min(tb.height, 36) / 2 - sb.top,
      });
    });
    setLines(out);
  }, []);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (stage.current) ro.observe(stage.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure, tab, plan.step]);

  const meta = TABS.find((t) => t.id === tab)!;
  const choose = (t: TourTab) => { setTab(t); setActive(null); setAuto(true); };
  const caption = (c: Callout) => (
    <button key={c.id} type="button" data-callout={c.region} data-side={c.side}
      aria-pressed={active === c.region}
      onPointerEnter={() => { setAuto(false); show(c.region); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") show(null); }}
      onFocus={() => { setAuto(false); show(c.region); }}
      onBlur={() => show(null)}
      onClick={() => { setAuto(false); show(c.region); }}
      className={cn("min-h-11 max-w-[15rem] rounded-lg px-2 py-2 text-base font-semibold leading-snug text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink max-lg:max-w-none max-lg:flex-1 max-lg:basis-[45%] max-lg:rounded-2xl max-lg:border max-lg:border-hairline max-lg:bg-canvas max-lg:px-3 max-lg:py-3 max-lg:text-left",
        c.side === "left" ? "text-right" : "text-left",
        active === c.region && "max-lg:border-ink")}>
      <span className={cn(active === c.region && "underline decoration-2 underline-offset-4 max-lg:no-underline")}>{c.label}</span>
      {active === c.region && <span className="mt-1 block text-sm font-normal text-slate">{c.detail}</span>}
    </button>
  );

  return (
    <section aria-labelledby="tour-title">
      <div className="text-center">
        <h2 id="tour-title" className="text-2xl font-semibold sm:text-3xl">See how it works</h2>
        <p className="mx-auto mt-2 max-w-xl text-lg text-charcoal">Point at a label, or tap it: the part of the app it talks about lights up.</p>
      </div>

      <div className="mt-6 flex justify-center">
        <div role="tablist" aria-label="Product preview" className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button key={t.id} role="tab" id={`tour-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="tour-panel" onClick={() => choose(t.id)}
              className={cn("min-h-12 shrink-0 rounded-full px-5 text-sm font-semibold sm:text-base", tab === t.id ? "bg-canvas text-ink shadow-sm" : "text-steel hover:text-ink")}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-3 max-w-xl text-center text-charcoal"><span className="font-semibold">{meta.title}.</span> {meta.text}</p>

      <div id="tour-panel" role="tabpanel" aria-labelledby={`tour-tab-${tab}`}>
        <Lit.Provider value={active}>
          <div ref={stage} onPointerDown={() => setAuto(false)}
            className={cn("relative mt-8 grid gap-4 lg:items-stretch lg:gap-7",
              tab === "voice" ? "lg:grid-cols-[minmax(0,1fr)_300px_minmax(0,1fr)]" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,720px)_minmax(0,1fr)]")}>
            <svg aria-hidden className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block">
              {lines.map((l) => {
                const on = active !== null && l.id.endsWith(`-${active}`);
                return (
                  <g key={l.id}>
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={on ? "var(--ink)" : "var(--hairline-strong)"} strokeWidth={on ? 1.5 : 1} />
                    <circle cx={l.x2} cy={l.y2} r={3.5} fill={on ? "var(--ink)" : "var(--hairline-strong)"} />
                  </g>
                );
              })}
            </svg>

            <div className="flex flex-col justify-around gap-2 max-lg:order-2 max-lg:flex-row max-lg:flex-wrap lg:items-end">
              {left.map(caption)}
            </div>
            <div className="min-w-0 max-lg:order-1 max-lg:mx-auto max-lg:w-full max-lg:max-w-[720px]">
              {tab === "platform" && <Platform plan={plan} />}
              {tab === "plan" && <PlanPreview plan={plan} act={act} />}
              {tab === "voice" && <VoicePreview />}
            </div>
            <div className="flex flex-col justify-around gap-2 max-lg:order-3 max-lg:flex-row max-lg:flex-wrap lg:items-start">
              {right.map(caption)}
            </div>
          </div>
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

/* ---------- frames ---------- */
function Browser({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-hairline bg-canvas shadow-[0_16px_48px_-8px_rgba(5,0,56,0.12)]">
      <div className="flex items-center gap-3 border-b border-hairline-soft px-4 py-3">
        <span className="flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className="size-[11px] rounded-full bg-hairline" />)}</span>
        <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-surface px-3 py-1 text-[13px] text-slate"><Lock size={12} aria-hidden /> {url}</span>
      </div>
      {children}
    </div>
  );
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("whitespace-nowrap rounded-full border border-hairline bg-canvas px-2.5 py-1 text-xs font-semibold", className)}>{children}</span>;
}

/* ---------- tab 1: the connected platform ---------- */
const NAV = ["Home", "Practice", "AI Chat", "Groups", "Progress", "Profile"];

function Ring({ done, goal }: { done: number; goal: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--hairline-soft)" strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ink)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${c * Math.min(done / goal, 1)} ${c}`} transform="rotate(-90 32 32)" />
    </svg>
  );
}

function Platform({ plan }: { plan: PlanDemo }) {
  const v = planView(plan);
  return (
    <Browser url="tkallem.vercel.app/practice">
      <div className="grid min-h-[480px] grid-cols-1 text-[13px] md:grid-cols-[132px_1fr]">
        <aside className="hidden flex-col gap-1 border-r border-hairline-soft p-3 md:flex" aria-hidden>
          <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold"><b className="flex size-[26px] items-center justify-center rounded-lg bg-brand-yellow text-[13px]">T</b>Tkallem</div>
          {NAV.map((n) => n === "Groups"
            ? <R key={n} id="groups" className="rounded-full px-2.5 py-2 font-medium text-slate">{n}</R>
            : <div key={n} className={cn("rounded-full px-2.5 py-2 font-medium", n === "Home" ? "bg-ink text-white" : "text-slate")}>{n}</div>)}
        </aside>
        <div className="min-w-0 p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate">Salam Amina · {v.level}</span>
            <R id="credits" as="span"><Pill className="inline-flex items-center gap-1"><Zap size={12} aria-hidden /> 33 free answers</Pill></R>
          </div>
          <h3 className="mb-3 text-[22px] font-medium leading-tight tracking-tight">Ready for {v.minutes} minutes of speaking?</h3>
          <R id="kpi" className="mb-3 grid grid-cols-3 gap-2">
            {[["Mistakes per 100 words", "12.4", "↓ 3.1"], ["Practice this week", "42 min", ""], ["Streak", "3 days", ""]].map(([k, val, d]) => (
              <div key={k} className="rounded-2xl border border-hairline p-2.5"><span className="block text-[11px] text-slate">{k}</span><b className="text-xl font-medium">{val}</b>{d && <em className="ml-1 text-[11px] font-semibold not-italic text-good">{d}</em>}</div>
            ))}
          </R>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div>
              <R id="plan" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Your plan, in order</R>
              <R id="situations" className="grid grid-cols-2 gap-2">
                {v.path.map((s, i) => (
                  <div key={s.id} className={cn("flex min-h-[92px] flex-col gap-1.5 rounded-[18px] p-3", scenarioTint(s.category), s.category === "speaking" && "border border-hairline-soft")}>
                    <span className="flex size-[22px] items-center justify-center rounded-full bg-canvas text-[11px] font-semibold">{i + 1}</span>
                    <span className="flex items-start justify-between gap-1 text-sm font-semibold"><span>{s.title}</span><Icon name={s.icon} size={15} /></span>
                    <small className="text-[11px] text-charcoal">{s.minutes} min · {s.level}</small>
                    {i === 1 ? <R id="real" as="span" className="mt-auto text-[11px] font-semibold">Real interview →</R> : <span className="mt-auto text-[11px] font-semibold">Practice →</span>}
                  </div>
                ))}
              </R>
            </div>
            <div className="space-y-2.5">
              <R id="goal" className="rounded-2xl border border-hairline p-3"><h4 className="mb-2 text-[13px] font-semibold">Today&apos;s goal</h4>
                <div className="flex items-center gap-2.5"><Ring done={6} goal={v.minutes} /><div><b className="text-base">6 / {v.minutes} min</b><div className="text-xs text-slate">Practice today</div></div></div></R>
              <R id="mistakes" className="rounded-2xl border border-hairline p-3"><h4 className="mb-1 text-[13px] font-semibold">Your top mistakes</h4>
                {[["Verb tense", "5×"], ["Articles", "3×"]].map(([k, n]) => <div key={k} className="flex justify-between border-t border-hairline-soft py-1.5 text-xs first:border-0">{k}<b className="text-slate">{n}</b></div>)}</R>
              <R id="recent" className="rounded-2xl border border-hairline p-3"><h4 className="mb-1 text-[13px] font-semibold">Recent sessions</h4>
                {[["Visa interview", "2 h ago"], ["At the airport", "Mon"]].map(([k, n]) => <div key={k} className="flex justify-between border-t border-hairline-soft py-1.5 text-xs first:border-0">{k}<b className="text-slate">{n}</b></div>)}</R>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ---------- tab 2: the plan, answered for real ---------- */
function Choice({ title, text, selected, onClick, multi, disabled }: { title: string; text?: string; selected: boolean; onClick: () => void; multi?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={multi ? selected : undefined}
      className={cn("mb-2 flex min-h-12 w-full items-center gap-2 rounded-[20px] border px-4 py-2.5 text-left text-sm font-semibold transition disabled:opacity-40",
        selected ? "border-ink bg-surface" : "border-hairline bg-canvas hover:border-hairline-strong")}>
      <span className="min-w-0 flex-1">{title}{text && <small className="block text-xs font-normal text-slate">{text}</small>}</span>
      {multi && selected && <Check size={16} aria-hidden />}
    </button>
  );
}

function PlanPreview({ plan, act }: { plan: PlanDemo; act: (a: PlanAction) => void }) {
  const v = planView(plan);
  const done = plan.step >= PLAN_STEPS;
  return (
    <Browser url="tkallem.vercel.app/plan">
      <div className="flex min-h-[480px] flex-col p-5 text-sm md:px-8">
        {done ? (
          <>
            <R id="result" className="mb-3">
              <h3 className="text-[22px] font-medium">Your plan</h3>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt className="text-slate">Goal</dt><dd className="font-semibold">{GOALS.find((g) => g.id === v.goal)?.label}</dd>
                <dt className="text-slate">Level</dt><dd className="font-semibold">{v.level}</dd>
                <dt className="text-slate">Daily goal</dt><dd className="font-semibold">{v.minutes} minutes</dd>
                <dt className="text-slate">Working on</dt><dd className="font-semibold">{FOCUS_CHOICES.filter((f) => v.focus.includes(f.id)).map((f) => f.label).join(", ")}</dd>
              </dl>
            </R>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Practise in this order</p>
            <R id="order" className="grid grid-cols-2 gap-2">
              {v.path.slice(0, 4).map((s, i) => (
                <div key={s.id} className={cn("flex min-h-[72px] items-center gap-2 rounded-[18px] p-3", scenarioTint(s.category), s.category === "speaking" && "border border-hairline-soft")}>
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-canvas text-[11px] font-semibold">{i + 1}</span>
                  <span className="min-w-0 text-[13px] font-semibold">{s.title}<small className="block text-[11px] font-normal">{s.minutes} min · {s.level}</small></span>
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
              <div className="h-1.5 overflow-hidden rounded-full bg-hairline"><div className="h-full rounded-full bg-ink transition-all" style={{ width: `${((plan.step + 1) / PLAN_STEPS) * 100}%` }} /></div>
            </R>
            <R id="question" className="mb-3">
              <h3 className="text-[22px] font-medium leading-tight">{["Why do you need English?", "How is your English when you speak?", "How much time can you practise each day?", "What is hardest for you?", "Which subjects do you like?"][plan.step]}</h3>
              <p className="mt-1 text-[13px] text-slate">{["We start with the situations that match your goal.", "No test. It sets how the coach talks to you.", "This becomes your daily goal.", `Pick up to ${MAX_FOCUS}. The coach keeps them in mind.`, "Optional. They decide which situations come next."][plan.step]}</p>
            </R>
            <R id="choices">
              {plan.step === 0 && GOALS.map((g) => <Choice key={g.id} title={g.label} selected={plan.goal === g.id} onClick={() => act({ type: "goal", value: g.id })} />)}
              {plan.step === 1 && LEVEL_CHOICES.map((l) => <Choice key={l.level} title={l.title} text={l.text} selected={plan.level === l.level} onClick={() => act({ type: "level", value: l.level })} />)}
              {plan.step === 2 && MINUTE_CHOICES.map((m) => <Choice key={m} title={`${m} minutes`} selected={plan.minutes === m} onClick={() => act({ type: "minutes", value: m })} />)}
              {plan.step === 3 && FOCUS_CHOICES.map((f) => <Choice key={f.id} title={f.label} text={f.text} multi selected={plan.focus.includes(f.id)} disabled={!plan.focus.includes(f.id) && plan.focus.length >= MAX_FOCUS} onClick={() => act({ type: "focus", value: f.id })} />)}
              {plan.step === 4 && <div className="grid grid-cols-2 gap-x-2">{INTEREST_CHOICES.map((i) => <Choice key={i.id} title={i.label} multi selected={plan.interests.includes(i.id)} onClick={() => act({ type: "interest", value: i.id })} />)}</div>}
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
  return (
    <div className="mx-auto w-[300px] max-w-full overflow-hidden rounded-[38px] border-8 border-ink bg-canvas lg:w-full">
      <div className="flex h-5 items-center justify-center" aria-hidden><i className="h-1.5 w-[70px] rounded-full bg-hairline" /></div>
      <div className="flex min-h-[540px] flex-col items-center gap-3 px-4 pb-5 pt-2 text-[13px]">
        <div className="flex w-full justify-between"><Pill>Visa interview</Pill><Pill className="inline-flex items-center gap-1"><Globe size={11} aria-hidden /> Voice</Pill></div>
        <p className="w-full rounded-[20px] rounded-bl-md bg-surface px-3.5 py-2.5">How will you pay for your studies?</p>
        <R id="state" className="text-center">
          <p className="text-[15px] font-semibold">Listening…</p>
          <div className="mt-1 flex h-7 items-center justify-center gap-1" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => <i key={i} className="w-1 animate-[tour-wave_1s_ease-in-out_infinite] rounded bg-ink motion-reduce:h-3.5 motion-reduce:animate-none" style={{ animationDelay: `${(i % 3) * 0.2}s`, height: 6 }} />)}
          </div>
        </R>
        <R id="mic" className="my-1 flex size-24 items-center justify-center !rounded-full bg-ink text-white shadow-[0_0_0_8px_#fff,0_0_0_11px_var(--brand-yellow)]"><Mic size={38} aria-hidden /></R>
        <R id="mic" className="text-xs text-slate">Tap to speak, tap again to send</R>
        <R id="transcript" className="w-full rounded-[20px] rounded-br-md bg-ink px-3.5 py-2.5 text-white">My father will pay for my studies.</R>
        <R id="backup" className="mt-auto flex items-center gap-1.5 text-xs text-slate"><Lightbulb size={12} aria-hidden /> Coach voice · backup ready</R>
      </div>
    </div>
  );
}
