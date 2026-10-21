"use client";
import { useState } from "react";
import { Check, Lightbulb, Lock, Mic, Zap } from "lucide-react";
import { scenarioTint } from "@/lib/tint";
import { cn } from "@/lib/utils";
import { FOCUS_CHOICES, GOALS, planOrder } from "@/features/plan/lib/plan";
import { Browser, Pill, R } from "./TourParts";
import { DEMO_SCENARIOS, PAGES, menuOf, planView, type DemoScenario, type PlanDemo, type PlatformPage } from "./tour";

const URL: Record<PlatformPage, string> = {
  home: "tkallem.vercel.app", practice: "tkallem.vercel.app/practice", chat: "tkallem.vercel.app/ai-chat",
  progress: "tkallem.vercel.app/progress", profile: "tkallem.vercel.app/profile",
};

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

const Box = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("rounded-2xl border border-hairline p-3", className)}>{children}</div>;
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between border-t border-hairline-soft py-1.5 text-xs first:border-0">{k}<b className="text-slate">{v}</b></div>;
const Head = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="mb-3"><span className="text-xs text-slate">{eyebrow}</span><h3 className="text-[22px] font-medium leading-tight tracking-tight">{title}</h3></div>
);

function Card({ s, i, real, onOpen }: { s: DemoScenario; i?: number; real?: boolean; onOpen: () => void }) {
  return (
    <div className={cn("flex min-h-[92px] flex-col gap-1.5 rounded-[18px] p-3", scenarioTint(s.category), s.category === "speaking" && "border border-hairline-soft")}>
      {i !== undefined && <span className="flex size-[22px] items-center justify-center rounded-full bg-canvas text-xs font-semibold">{i + 1}</span>}
      <span className="text-sm font-semibold">{s.title}</span>
      <small className="text-xs text-charcoal">{s.minutes} min · {s.level}</small>
      <button type="button" onClick={onOpen} className="mt-auto min-h-11 self-start text-left text-xs font-semibold underline-offset-2 hover:underline">
        {real ? <R id="real" as="span">Real interview →</R> : "Practice →"}
      </button>
    </div>
  );
}

/* ---------- the pages ---------- */
function Home({ plan, open }: { plan: PlanDemo; open: () => void }) {
  const v = planView(plan);
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate">Salam Amina · {v.level}</span>
        <R id="credits" as="span"><Pill className="inline-flex items-center gap-1"><Zap size={12} aria-hidden /> 33 free answers</Pill></R>
      </div>
      <h3 className="mb-3 text-[22px] font-medium leading-tight tracking-tight">Ready for {v.minutes} minutes of speaking?</h3>
      <R id="kpi" className="mb-3 grid grid-cols-3 gap-2">
        {[["Mistakes per 100 words", "12.4", "↓ 3.1"], ["Practice this week", "42 min", ""], ["Streak", "3 days", ""]].map(([k, val, d]) => (
          <div key={k} className="rounded-2xl border border-hairline p-2.5"><span className="block text-xs text-slate">{k}</span><b className="text-xl font-medium">{val}</b>{d && <em className="ml-1 text-xs font-semibold not-italic text-good">{d}</em>}</div>
        ))}
      </R>
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <div>
          <R id="plan" className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">Your plan, in order</R>
          <R id="situations" className="grid grid-cols-2 gap-2">{v.path.map((s, i) => <Card key={s.id} s={s} i={i} real={i === 1} onOpen={open} />)}</R>
        </div>
        <div className="space-y-2.5">
          <R id="goal"><Box><h4 className="mb-2 text-[13px] font-semibold">Today&apos;s goal</h4>
            <div className="flex items-center gap-2.5"><Ring done={6} goal={v.minutes} /><div><b className="text-base">6 / {v.minutes} min</b><div className="text-xs text-slate">Practice today</div></div></div></Box></R>
          <R id="mistakes"><Box><h4 className="mb-1 text-[13px] font-semibold">Your top mistakes</h4><Row k="Verb tense" v="5×" /><Row k="Articles" v="3×" /></Box></R>
          <R id="recent"><Box><h4 className="mb-1 text-[13px] font-semibold">Recent sessions</h4><Row k="Visa interview" v="2 h ago" /><Row k="At the airport" v="Mon" /></Box></R>
        </div>
      </div>
    </>
  );
}

function Practice({ plan, open }: { plan: PlanDemo; open: () => void }) {
  const v = planView(plan);
  const all = planOrder(DEMO_SCENARIOS, v.goal, plan.interests).slice(0, 6);
  return (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        <Head eyebrow={`Practice · ${v.level}`} title="Choose your next practice" />
        <R id="planlink" as="span" className="mt-1 whitespace-nowrap text-xs font-semibold underline">Your plan</R>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_170px]">
        <R id="grid" className="grid grid-cols-2 gap-2">{all.map((s, i) => <Card key={s.id} s={s} real={i === 0 ? true : undefined} onOpen={open} />)}</R>
        <R id="recent"><Box><h4 className="mb-1 text-[13px] font-semibold">Recent sessions</h4><Row k="Visa interview" v="2 h ago" /><Row k="At the airport" v="Mon" /><Row k="Taking a taxi" v="Sun" /></Box></R>
      </div>
    </>
  );
}

function Chat() {
  const [real, setReal] = useState(false);
  const [helped, setHelped] = useState(false);
  return (
    <div className="flex min-h-[420px] flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <Pill>Visa interview</Pill>
        <R id="mode" as="span" className="inline-flex rounded-full bg-surface p-[3px] text-xs font-semibold">
          {[["Practice", false], ["Real interview", true]].map(([l, r]) => (
            <button key={String(l)} type="button" onClick={() => setReal(r as boolean)} aria-pressed={real === r}
              className={cn("min-h-11 rounded-full px-3 md:min-h-8", real === r ? "bg-ink text-white" : "text-slate")}>{l}</button>
          ))}
        </R>
      </div>
      <R id="question" className="max-w-[78%] self-start rounded-[20px] rounded-bl-md bg-surface px-3.5 py-2.5">What is the purpose of your trip?</R>
      <p className="max-w-[78%] self-end rounded-[20px] rounded-br-md bg-ink px-3.5 py-2.5 text-white">I go to US for study my master.</p>
      <R id="feedback" className="flex flex-col items-end gap-2">
        {real ? (
          <p className="max-w-[84%] rounded-xl bg-surface px-3 py-2 text-slate">Thank you. Nothing is shown until the report, like the real interview.</p>
        ) : (
          <>
            <p className="max-w-[84%] rounded-xl bg-good-bg px-3 py-2 font-semibold text-good"><Check size={13} className="mr-1 inline" aria-hidden />Clear purpose: “study my master”.</p>
            <p className="max-w-[84%] rounded-2xl border border-hairline bg-warn-bg px-3 py-2"><s className="text-bad">I go to US for study my master</s> → <b className="text-good">I am going to the US to study for my master’s</b>
              <small className="mt-1 block text-slate">Use “to + verb” for a purpose, and add “the” before US.</small></p>
          </>
        )}
      </R>
      {!real && <R id="again" className="self-end"><button type="button" className="min-h-11 md:min-h-9 rounded-full bg-ink px-4 text-xs font-semibold text-white">Say it again</button></R>}
      {real && <R id="again" className="self-end text-xs text-slate">Say it again opens in the report</R>}
      {helped && <p className="rounded-xl bg-surface px-3 py-2 text-xs">You can start with: <b>The main purpose of my trip is to…</b></p>}
      <div className="mt-auto flex items-center gap-2">
        <R id="help"><button type="button" onClick={() => setHelped((h) => !h)} className="inline-flex min-h-11 md:min-h-9 items-center gap-1.5 rounded-full border border-hairline-strong px-3 text-xs font-semibold"><Lightbulb size={13} aria-hidden /> Help me start</button></R>
        <R id="answer" className="flex flex-1 items-center gap-2"><span className="flex-1 rounded-full border border-hairline px-3.5 py-2.5 text-stone">Type or speak your answer…</span>
          <span className="flex size-11 items-center justify-center rounded-full bg-ink text-white"><Mic size={18} aria-hidden /></span></R>
      </div>
    </div>
  );
}

function Progress() {
  return (
    <div className="min-h-[420px]">
      <Head eyebrow="Salam Amina" title="Track your progress" />
      <R id="metrics" className="mb-3 grid grid-cols-3 gap-2">
        {[["Mistakes per 100 words", "12.4", "↓ 3.1"], ["Words per answer", "48", "↑ 9"], ["Hesitations per minute", "5", "↓ 2"]].map(([k, v, d]) => (
          <div key={k} className="rounded-2xl border border-hairline p-2.5"><span className="block text-xs text-slate">{k}</span><b className="text-xl font-medium">{v}</b><em className="ml-1 text-xs font-semibold not-italic text-good">{d}</em></div>
        ))}
      </R>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-3">
          <R id="freeze"><Box><h4 className="text-[13px] font-semibold">Time before you speak</h4><b className="text-3xl font-medium tracking-tight">3.0 s</b><div className="text-xs text-slate">was 9.3 s</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-hairline-soft"><i className="block h-full w-1/3 bg-ink" /></div></Box></R>
          <R id="confidence"><Box><h4 className="text-[13px] font-semibold">How confident you feel</h4><b className="text-3xl font-medium tracking-tight">2 → 4</b><div className="text-xs text-slate">before → after, 1 to 5</div></Box></R>
        </div>
        <R id="top"><Box className="h-full"><h4 className="mb-1 text-[13px] font-semibold">Top mistakes</h4>
          {[["Verb tense", "I go → I went", "5×"], ["Articles", "to US → to the US", "3×"], ["Prepositions", "for study → to study", "2×"]].map(([k, ex, n]) => (
            <div key={k} className="flex items-center justify-between border-t border-hairline-soft py-2 text-xs first:border-0"><span><b className="block text-[13px]">{k}</b><span className="text-slate">{ex}</span></span><b className="rounded-full bg-surface px-2 py-0.5">{n}</b></div>
          ))}</Box></R>
      </div>
    </div>
  );
}

function Profile({ plan }: { plan: PlanDemo }) {
  const v = planView(plan);
  const rows: [string, string][] = [["English level", v.level], ["Learning goal", GOALS.find((g) => g.id === v.goal)?.label ?? ""], ["Daily goal", `${v.minutes} minutes of speaking`]];
  return (
    <div className="min-h-[420px]">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface text-xl font-medium">AM</span>
        <div><h3 className="text-[22px] font-medium leading-tight">Amina</h3><Pill>Learning English · {v.level}</Pill></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate">My learning setup</p>
          <R id="setup" className="space-y-2">{rows.map(([k, t]) => <Box key={k} className="py-2.5"><b className="block text-[13px]">{k}</b><span className="text-xs text-slate">{t}</span></Box>)}</R>
          <R id="lang"><Box className="py-2.5"><b className="block text-[13px]">Explanation language</b><span className="text-xs text-slate">French (Français)</span></Box></R>
          <R id="focus"><Box className="py-2.5"><b className="block text-[13px]">Focus areas</b><span className="text-xs text-slate">{FOCUS_CHOICES.filter((f) => v.focus.includes(f.id)).map((f) => f.label).join(", ")}</span></Box></R>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">My achievements</p>
          <R id="badges" className="space-y-2">
            {[["First session", "Finish your first practice session.", true], ["3-day streak", "Practice 3 days in a row.", true], ["First spoken session", "Answer every question out loud.", false], ["Level B1", "Practice at level B1 or above.", false]].map(([t, d, ok]) => (
              <Box key={String(t)} className="flex items-center gap-2 py-2.5"><span className="min-w-0 flex-1"><b className="block text-[13px]">{t}</b><span className="text-xs text-slate">{d}</span></span>
                {ok ? <Check size={16} className="text-good" aria-hidden /> : <Lock size={14} className="text-stone" aria-hidden />}</Box>
            ))}
          </R>
        </div>
      </div>
    </div>
  );
}

/* ---------- the app: a sidebar that works ---------- */
export default function Platform({ plan, page, onPage }: { plan: PlanDemo; page: PlatformPage; onPage: (p: PlatformPage) => void }) {
  return (
    <Browser url={URL[page]}>
      <div className="grid min-h-[600px] grid-cols-1 text-[13px] md:grid-cols-[132px_1fr]">
        <aside className="hidden flex-col gap-1 border-r border-hairline-soft p-3 md:flex">
          <div className="mb-2 flex items-center gap-2 text-[15px] font-semibold" aria-hidden><b className="flex size-[26px] items-center justify-center rounded-lg bg-brand-yellow text-[13px]">T</b>Tkallem</div>
          <R id="nav" className="flex flex-col gap-1" >
            {PAGES.map((p) => (
              <button key={p.id} type="button" onClick={() => onPage(p.id)} aria-current={menuOf(page) === p.id ? "page" : undefined}
                className={cn("min-h-11 rounded-full px-2.5 text-left font-medium", menuOf(page) === p.id ? "bg-ink text-white" : "text-slate hover:bg-surface")}>{p.label}</button>
            ))}
          </R>
        </aside>
        <div className="min-w-0 p-4 md:p-5">
          <nav aria-label="Pages" className="mb-3 flex gap-1 overflow-x-auto md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PAGES.map((p) => (
              <button key={p.id} type="button" onClick={() => onPage(p.id)} aria-current={menuOf(page) === p.id ? "page" : undefined}
                className={cn("min-h-11 shrink-0 rounded-full px-3.5 text-sm font-semibold", menuOf(page) === p.id ? "bg-ink text-white" : "bg-surface text-slate")}>{p.label}</button>
            ))}
          </nav>
          {page === "home" && <Home plan={plan} open={() => onPage("chat")} />}
          {page === "practice" && <Practice plan={plan} open={() => onPage("chat")} />}
          {page === "chat" && <Chat />}
          {page === "progress" && <Progress />}
          {page === "profile" && <Profile plan={plan} />}
        </div>
      </div>
    </Browser>
  );
}
